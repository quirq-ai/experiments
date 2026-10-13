// Spawns and talks to the two app-servers. Both speak the same protocol, so
// everything above `spawnCommand` is engine-agnostic.
import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { LinePeer } from '../shared/rpc'
import {
  APPROVAL_METHODS,
  type ApprovalDecision,
  type InitializeResponse,
  type Model,
  type ModelListResponse
} from '../shared/protocol'
import type { EngineId, EngineStatus } from '../shared/types'

export interface EngineHooks {
  onNotification(engine: EngineId, method: string, params: any): void
  onApproval(engine: EngineId, method: string, params: any): Promise<ApprovalDecision>
  onStatus(status: EngineStatus): void
  onExit(engine: EngineId): void
}

function spawnCommand(engine: EngineId): { cmd: string; args: string[]; env: NodeJS.ProcessEnv } {
  if (engine === 'codex') {
    return { cmd: process.env.WORKBENCH_CODEX_BIN ?? 'codex', args: ['app-server'], env: process.env }
  }
  // claude-app-server ships inside this app and runs on Electron's bundled Node.
  return {
    cmd: process.execPath,
    args: [join(import.meta.dirname, 'claude-app-server.js')],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  }
}

export class EngineClient {
  private child?: ChildProcess
  private peer?: LinePeer
  private ready?: Promise<LinePeer>
  private models?: Model[]
  /** Threads this server process has loaded (thread/start or thread/resume). */
  readonly loaded = new Set<string>()
  status: EngineStatus

  constructor(
    readonly engine: EngineId,
    private hooks: EngineHooks
  ) {
    this.status = { engine, state: 'idle' }
  }

  private setStatus(s: Omit<EngineStatus, 'engine'>): void {
    this.status = { engine: this.engine, ...s }
    this.hooks.onStatus(this.status)
  }

  connect(): Promise<LinePeer> {
    if (this.ready) return this.ready
    this.ready = this.start().catch((e) => {
      this.ready = undefined
      this.setStatus({ state: 'error', message: (e as Error).message })
      throw e
    })
    return this.ready
  }

  private async start(): Promise<LinePeer> {
    this.setStatus({ state: 'starting' })
    const { cmd, args, env } = spawnCommand(this.engine)
    const child = spawn(cmd, args, { env, stdio: ['pipe', 'pipe', 'pipe'] })
    this.child = child
    child.stderr!.setEncoding('utf8')
    child.stderr!.on('data', (d: string) => process.stderr.write(`[${this.engine}] ${d}`))
    const spawnError = new Promise<never>((_, reject) => child.once('error', reject))
    child.once('exit', (code) => {
      this.peer?.failAll(new Error(`${this.engine} app-server exited (${code})`))
      this.peer = undefined
      this.ready = undefined
      this.loaded.clear()
      this.setStatus({ state: 'error', message: `app-server exited with code ${code}` })
      this.hooks.onExit(this.engine)
    })

    const peer = new LinePeer(child.stdout!, child.stdin!, (line) => {
      if (process.env.WORKBENCH_DEBUG) process.stderr.write(`[${this.engine}] ${line}\n`)
    })
    peer.onNotification((params, method) => this.hooks.onNotification(this.engine, method, params))
    for (const m of APPROVAL_METHODS) {
      peer.onRequest(m, async (params) => ({ decision: await this.hooks.onApproval(this.engine, m, params) }))
    }

    const init = await Promise.race([
      peer.request<InitializeResponse>('initialize', {
        clientInfo: { name: 'workbench', title: 'Workbench', version: '0.1.0' },
        capabilities: { experimentalApi: false, requestAttestation: false }
      }),
      spawnError
    ])
    peer.notify('initialized')
    this.peer = peer
    this.setStatus({ state: 'ready', userAgent: init.userAgent })
    return peer
  }

  async request<R>(method: string, params?: unknown): Promise<R> {
    const peer = await this.connect()
    return peer.request<R>(method, params)
  }

  async listModels(): Promise<Model[]> {
    if (this.models) return this.models
    const res = await this.request<ModelListResponse>('model/list', {})
    this.models = res.data.filter((m) => !m.hidden)
    return this.models
  }

  dispose(): void {
    this.child?.kill()
  }
}
