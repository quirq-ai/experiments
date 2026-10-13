import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { EngineClient } from './engines'
import { gitDiff } from './git'
import { Store } from './store'
import { applyNotification } from '../shared/transcript'
import type {
  ApprovalDecision,
  ApprovalMethod,
  ThreadStartResponse,
  TurnStartResponse
} from '../shared/protocol'
import {
  accessPolicy,
  threadKey,
  type ApprovalRequest,
  type EngineId,
  type ThreadKey,
  type ThreadMeta,
  type TurnSettings,
  type WorkbenchEvent
} from '../shared/types'

let win: BrowserWindow | null = null
let store: Store

const pendingApprovals = new Map<string, { request: ApprovalRequest; resolve: (d: ApprovalDecision) => void }>()

function emit(e: WorkbenchEvent): void {
  win?.webContents.send('workbench:event', e)
}

function keyFromParams(engine: EngineId, params: any): ThreadKey | null {
  const id = params?.threadId ?? params?.thread?.id
  return id ? threadKey(engine, id) : null
}

const hooks = {
  onNotification(engine: EngineId, method: string, params: any) {
    const key = keyFromParams(engine, params)
    if (!key || !store.getThread(key)) return
    store.setTranscript(key, applyNotification(store.getTranscript(key), method, params))
    if (method === 'turn/completed') touchThread(key)
    emit({ type: 'notification', key, method, params })
  },
  onApproval(engine: EngineId, method: string, params: any): Promise<ApprovalDecision> {
    const request: ApprovalRequest = {
      requestKey: randomUUID(),
      key: threadKey(engine, params.threadId),
      method: method as ApprovalMethod,
      itemId: params.itemId,
      command: params.command ?? null,
      reason: params.reason ?? null
    }
    return new Promise((resolve) => {
      pendingApprovals.set(request.requestKey, { request, resolve })
      emit({ type: 'approval', request })
    })
  },
  onStatus(status: import('../shared/types').EngineStatus) {
    emit({ type: 'engine-status', status })
  },
  onExit(engine: EngineId) {
    // Release any approvals the dead server was waiting on.
    for (const [k, p] of pendingApprovals) {
      if (p.request.key.startsWith(`${engine}:`)) {
        pendingApprovals.delete(k)
        emit({ type: 'approval-resolved', requestKey: k })
      }
    }
  }
}

const engines: Record<EngineId, EngineClient> = {
  codex: new EngineClient('codex', hooks),
  claude: new EngineClient('claude', hooks)
}

function touchThread(key: ThreadKey, patch: Partial<ThreadMeta> = {}): void {
  const meta = store.getThread(key)
  if (!meta) return
  const next = { ...meta, ...patch, updatedAt: Date.now() }
  store.upsertThread(next)
  emit({ type: 'thread-updated', meta: next })
}

async function ensureLoaded(meta: ThreadMeta, settings: TurnSettings): Promise<void> {
  const engine = engines[meta.engine]
  await engine.connect()
  if (engine.loaded.has(meta.id)) return
  const { approvalPolicy, sandboxPolicy } = accessPolicy(settings.access)
  await engine.request<ThreadStartResponse>('thread/resume', {
    threadId: meta.id,
    cwd: meta.cwd,
    model: settings.model,
    approvalPolicy,
    sandbox: sandboxPolicy.type === 'readOnly' ? 'read-only' : sandboxPolicy.type === 'dangerFullAccess' ? 'danger-full-access' : 'workspace-write',
    excludeTurns: true
  })
  engine.loaded.add(meta.id)
}

function registerIpc(): void {
  const h = <A extends unknown[], R>(name: string, fn: (...args: A) => R) =>
    ipcMain.handle(`workbench:${name}`, (_e, ...args) => fn(...(args as A)))

  h('listProjects', () => store.listProjects())
  h('addProject', async () => {
    const res = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'] })
    if (res.canceled || !res.filePaths[0]) return null
    const p = { path: res.filePaths[0], name: basename(res.filePaths[0]), addedAt: Date.now() }
    store.addProject(p)
    return p
  })
  h('removeProject', (path: string) => store.removeProject(path))
  h('listThreads', (cwd: string) => store.listThreads(cwd))
  h('listModels', (engine: EngineId) => engines[engine].listModels())
  h('engineStatus', () => Object.values(engines).map((e) => e.status))

  h('createThread', async (engine: EngineId, cwd: string, settings: TurnSettings) => {
    const { approvalPolicy, sandboxPolicy } = accessPolicy(settings.access)
    const res = await engines[engine].request<ThreadStartResponse>('thread/start', {
      cwd,
      model: settings.model,
      approvalPolicy,
      sandbox: sandboxPolicy.type === 'readOnly' ? 'read-only' : sandboxPolicy.type === 'dangerFullAccess' ? 'danger-full-access' : 'workspace-write'
    })
    engines[engine].loaded.add(res.thread.id)
    const meta: ThreadMeta = {
      key: threadKey(engine, res.thread.id),
      id: res.thread.id,
      engine,
      cwd,
      title: 'New thread',
      model: res.model,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    store.upsertThread(meta)
    return meta
  })

  h('deleteThread', (key: ThreadKey) => store.deleteThread(key))
  h('getTranscript', (key: ThreadKey) => store.getTranscript(key))

  h('send', async (key: ThreadKey, text: string, settings: TurnSettings) => {
    const meta = store.getThread(key)
    if (!meta) throw new Error(`Unknown thread ${key}`)
    await ensureLoaded(meta, settings)
    if (meta.title === 'New thread') touchThread(key, { title: text.trim().split('\n')[0].slice(0, 80) })
    touchThread(key, { model: settings.model })
    const { approvalPolicy, sandboxPolicy } = accessPolicy(settings.access)
    await engines[meta.engine].request<TurnStartResponse>('turn/start', {
      threadId: meta.id,
      input: [{ type: 'text', text, text_elements: [] }],
      cwd: meta.cwd,
      model: settings.model,
      effort: settings.effort,
      approvalPolicy,
      sandboxPolicy
    })
  })

  h('interrupt', async (key: ThreadKey) => {
    const meta = store.getThread(key)
    const turnId = store.getTranscript(key).activeTurnId
    if (!meta || !turnId) return
    await engines[meta.engine].request('turn/interrupt', { threadId: meta.id, turnId })
  })

  h('respondApproval', (requestKey: string, decision: ApprovalDecision) => {
    const p = pendingApprovals.get(requestKey)
    if (!p) return
    pendingApprovals.delete(requestKey)
    p.resolve(decision)
    emit({ type: 'approval-resolved', requestKey })
  })
  h('pendingApprovals', () => [...pendingApprovals.values()].map((p) => p.request))
  h('gitDiff', (cwd: string) => gitDiff(cwd))
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 900,
    minHeight: 560,
    title: 'Workbench',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f1011',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  win.on('closed', () => (win = null))
}

// Separate data dir for dev/testing runs.
if (process.env.WORKBENCH_USER_DATA) app.setPath('userData', process.env.WORKBENCH_USER_DATA)

app.whenReady().then(() => {
  store = new Store(join(app.getPath('userData'), 'workbench'))
  registerIpc()
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('before-quit', () => {
  store?.flush()
  for (const e of Object.values(engines)) e.dispose()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
