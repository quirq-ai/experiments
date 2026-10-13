// claude-app-server: Claude Code (via the Claude Agent SDK) behind the Codex
// app-server wire protocol. Reads JSON-RPC lines on stdin, writes on stdout.
// Run standalone with: node out/main/claude-app-server.js
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import {
  getSessionInfo,
  query,
  type CanUseTool,
  type PermissionMode,
  type SDKMessage
} from '@anthropic-ai/claude-agent-sdk'
import { LinePeer, RpcError } from '../shared/rpc'
import type {
  ApprovalDecision,
  AskForApproval,
  FileUpdateChange,
  InitializeResponse,
  Model,
  ModelListResponse,
  ReasoningEffort,
  SandboxMode,
  SandboxPolicy,
  Thread,
  ThreadItem,
  ThreadResumeParams,
  ThreadStartParams,
  ThreadStartResponse,
  Turn,
  TurnInterruptParams,
  TurnStartParams,
  TurnStartResponse
} from '../shared/protocol'

// stdout is the protocol channel; keep stray logging off it.
console.log = (...args: unknown[]) => process.stderr.write(args.map(String).join(' ') + '\n')

const VERSION = '0.1.0'
const DEFAULT_MODEL = 'claude-opus-5-5'
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
type ClaudeEffort = (typeof EFFORTS)[number]

const MODELS: Model[] = [
  ['claude-opus-5-5', 'Claude Opus 5.5', 'Default. Strong at coding and long agentic work.', 'medium'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5', 'Fast everyday coding and agent work.', 'high'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5', 'Fastest and cheapest.', 'medium'],
  ['claude-fable-5-1', 'Claude Fable 5.1', 'Most capable, for the hardest problems.', 'high']
].map(([id, displayName, description, def]) => ({
  id,
  model: id,
  displayName,
  description,
  hidden: false,
  supportedReasoningEfforts: EFFORTS.map((e) => ({ reasoningEffort: e, description: e })),
  defaultReasoningEffort: def as ReasoningEffort,
  isDefault: id === DEFAULT_MODEL
}))

interface ThreadState {
  id: string
  cwd: string
  model: string
  approvalPolicy: AskForApproval
  sandbox: SandboxMode
  createdAt: number
  hasSession: boolean
  active?: { turnId: string; abort: AbortController }
}

const threads = new Map<string, ThreadState>()
const peer = new LinePeer(process.stdin, process.stdout)

const now = () => Math.floor(Date.now() / 1000)

function toThread(t: ThreadState): Thread {
  return {
    id: t.id,
    preview: '',
    model: t.model,
    createdAt: t.createdAt,
    updatedAt: now(),
    cwd: t.cwd,
    name: null,
    turns: []
  }
}

function startResponse(t: ThreadState): ThreadStartResponse {
  return { thread: toThread(t), model: t.model, cwd: t.cwd, approvalPolicy: t.approvalPolicy, reasoningEffort: null }
}

function sandboxFromPolicy(p: SandboxPolicy | null | undefined): SandboxMode | undefined {
  if (!p) return undefined
  return p.type === 'readOnly' ? 'read-only' : p.type === 'dangerFullAccess' ? 'danger-full-access' : 'workspace-write'
}

// Codex approval + sandbox settings -> Claude Code permission mode.
function permissionModeFor(approval: AskForApproval, sandbox: SandboxMode): PermissionMode {
  if (sandbox === 'read-only') return 'plan'
  if (sandbox === 'danger-full-access' && approval === 'never') return 'bypassPermissions'
  if (approval === 'untrusted') return 'default'
  return 'acceptEdits'
}

function claudeEffort(e: ReasoningEffort | null | undefined): ClaudeEffort | undefined {
  if (!e) return undefined
  if (e === 'none' || e === 'minimal') return 'low'
  if (e === 'ultra') return 'max'
  return e
}

// ---- protocol handlers -------------------------------------------------------

peer.onRequest('initialize', (): InitializeResponse => ({
  userAgent: `claude-app-server/${VERSION}`,
  codexHome: `${homedir()}/.claude`,
  platformFamily: process.platform === 'win32' ? 'windows' : 'unix',
  platformOs: process.platform === 'darwin' ? 'macos' : process.platform
}))

peer.onRequest('model/list', (): ModelListResponse => ({ data: MODELS, nextCursor: null }))

peer.onRequest('thread/start', (p: ThreadStartParams): ThreadStartResponse => {
  const t: ThreadState = {
    id: randomUUID(),
    cwd: p.cwd ?? process.cwd(),
    model: p.model ?? DEFAULT_MODEL,
    approvalPolicy: p.approvalPolicy ?? 'on-request',
    sandbox: p.sandbox ?? 'workspace-write',
    createdAt: now(),
    hasSession: false
  }
  threads.set(t.id, t)
  peer.notify('thread/started', { thread: toThread(t) })
  return startResponse(t)
})

peer.onRequest('thread/resume', async (p: ThreadResumeParams): Promise<ThreadStartResponse> => {
  let t = threads.get(p.threadId)
  if (!t) {
    const cwd = p.cwd ?? process.cwd()
    const info = await getSessionInfo(p.threadId, { dir: cwd }).catch(() => undefined)
    t = {
      id: p.threadId,
      cwd,
      model: p.model ?? DEFAULT_MODEL,
      approvalPolicy: p.approvalPolicy ?? 'on-request',
      sandbox: p.sandbox ?? 'workspace-write',
      createdAt: now(),
      hasSession: !!info
    }
    threads.set(t.id, t)
  }
  return startResponse(t)
})

peer.onRequest('turn/start', (p: TurnStartParams): TurnStartResponse => {
  const t = threads.get(p.threadId)
  if (!t) throw new RpcError(-32602, `Unknown thread ${p.threadId}; call thread/resume first`)
  if (t.active) throw new RpcError(-32000, 'A turn is already running on this thread')
  if (p.cwd) t.cwd = p.cwd
  if (p.model) t.model = p.model
  if (p.approvalPolicy) t.approvalPolicy = p.approvalPolicy
  t.sandbox = sandboxFromPolicy(p.sandboxPolicy) ?? t.sandbox

  const turn: Turn = {
    id: randomUUID(),
    items: [],
    status: 'inProgress',
    error: null,
    startedAt: now(),
    completedAt: null,
    durationMs: null
  }
  const text = p.input.map((i) => i.text).join('\n')
  t.active = { turnId: turn.id, abort: new AbortController() }
  void runTurn(t, turn, text, claudeEffort(p.effort))
  return { turn }
})

peer.onRequest('turn/interrupt', (p: TurnInterruptParams) => {
  const t = threads.get(p.threadId)
  if (t?.active && t.active.turnId === p.turnId) t.active.abort.abort()
  return {}
})

peer.onNotification(() => {}) // `initialized` and anything else: nothing to do.

// ---- turn execution ----------------------------------------------------------

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write'])

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content))
    return content
      .map((c: any) => (c?.type === 'text' ? c.text : c?.type === 'image' ? '[image]' : ''))
      .filter(Boolean)
      .join('\n')
  return ''
}

function lineDiff(oldText: string, newText: string): string {
  oldText = oldText.replace(/\n$/, '')
  newText = newText.replace(/\n$/, '')
  const minus = oldText ? oldText.split('\n').map((l) => `-${l}`) : []
  const plus = newText ? newText.split('\n').map((l) => `+${l}`) : []
  return [`@@ -1,${minus.length} +1,${plus.length} @@`, ...minus, ...plus].join('\n')
}

function fileChanges(tool: string, input: any, cwd: string): FileUpdateChange[] {
  const abs = (p: string) => (p?.startsWith('/') ? p : `${cwd}/${p}`)
  if (tool === 'Write') {
    const exists = existsSync(abs(input.file_path))
    return [
      {
        path: input.file_path,
        kind: exists ? { type: 'update', move_path: null } : { type: 'add' },
        diff: lineDiff('', String(input.content ?? ''))
      }
    ]
  }
  const edits: { old_string: string; new_string: string }[] =
    tool === 'MultiEdit' ? (input.edits ?? []) : [{ old_string: input.old_string, new_string: input.new_string }]
  return [
    {
      path: input.file_path,
      kind: { type: 'update', move_path: null },
      diff: edits.map((e) => lineDiff(e.old_string ?? '', e.new_string ?? '')).join('\n')
    }
  ]
}

function toolItem(id: string, name: string, input: any, cwd: string): ThreadItem {
  if (name === 'Bash')
    return {
      type: 'commandExecution',
      id,
      command: String(input.command ?? ''),
      cwd,
      status: 'inProgress',
      aggregatedOutput: null,
      exitCode: null,
      durationMs: null
    }
  if (EDIT_TOOLS.has(name)) return { type: 'fileChange', id, changes: fileChanges(name, input, cwd), status: 'inProgress' }
  if (name === 'WebSearch') return { type: 'webSearch', id, query: input.query }
  if (name.startsWith('mcp__')) {
    const [, server, ...rest] = name.split('__')
    return { type: 'mcpToolCall', id, server, tool: rest.join('__'), status: 'inProgress', arguments: input, error: null }
  }
  return {
    type: 'dynamicToolCall',
    id,
    namespace: null,
    tool: name,
    arguments: input,
    status: 'inProgress',
    contentItems: null,
    success: null,
    durationMs: null
  }
}

function completeItem(item: ThreadItem, output: string, isError: boolean, declined: boolean, ms: number): ThreadItem {
  switch (item.type) {
    case 'commandExecution':
      return {
        ...item,
        status: declined ? 'declined' : isError ? 'failed' : 'completed',
        aggregatedOutput: output,
        exitCode: declined ? null : isError ? 1 : 0,
        durationMs: ms
      }
    case 'fileChange':
      return { ...item, status: declined ? 'declined' : isError ? 'failed' : 'completed' }
    case 'mcpToolCall':
      return { ...item, status: isError ? 'failed' : 'completed', error: isError ? { message: output } : null }
    case 'dynamicToolCall':
      return {
        ...item,
        status: isError ? 'failed' : 'completed',
        contentItems: [{ type: 'inputText', text: output }],
        success: !isError,
        durationMs: ms
      }
    default:
      return item
  }
}

async function runTurn(t: ThreadState, turn: Turn, text: string, effort: ClaudeEffort | undefined): Promise<void> {
  const threadId = t.id
  const turnId = turn.id
  const abort = t.active!.abort
  const started = Date.now()
  const ev = (method: string, params: object) => peer.notify(method, { threadId, turnId, ...params })

  peer.notify('turn/started', { threadId, turn })
  const userItem: ThreadItem = {
    type: 'userMessage',
    id: randomUUID(),
    clientId: null,
    content: [{ type: 'text', text, text_elements: [] }]
  }
  ev('item/started', { item: userItem, startedAtMs: Date.now() })
  ev('item/completed', { item: userItem, completedAtMs: Date.now() })

  const tools = new Map<string, { item: ThreadItem; startedAt: number }>()
  const declined = new Set<string>()
  const streamedMessages = new Set<string>()
  let live: { id: string; text: string } | null = null
  let error: string | null = null
  let isErrorResult = false

  const startTool = (id: string, name: string, input: any) => {
    if (tools.has(id)) return
    const item = toolItem(id, name, input, t.cwd)
    tools.set(id, { item, startedAt: Date.now() })
    ev('item/started', { item, startedAtMs: Date.now() })
  }

  const approvalPolicy = t.approvalPolicy
  const canUseTool: CanUseTool = async (toolName, input, opts) => {
    if (approvalPolicy === 'never') return { behavior: 'allow', updatedInput: input }
    startTool(opts.toolUseID, toolName, input)
    const base = { threadId, turnId, itemId: opts.toolUseID, startedAtMs: Date.now(), reason: opts.decisionReason ?? null }
    const isEdit = EDIT_TOOLS.has(toolName)
    const method = isEdit ? 'item/fileChange/requestApproval' : 'item/commandExecution/requestApproval'
    const params = isEdit
      ? { ...base, grantRoot: null }
      : {
          ...base,
          kind: 'command',
          environmentId: null,
          cwd: t.cwd,
          command: toolName === 'Bash' ? String(input.command ?? '') : (opts.title ?? `${toolName} ${JSON.stringify(input)}`)
        }
    const res = await Promise.race([
      peer.request<{ decision: ApprovalDecision }>(method, params),
      new Promise<{ decision: ApprovalDecision }>((resolve) =>
        opts.signal.addEventListener('abort', () => resolve({ decision: 'cancel' }), { once: true })
      )
    ])
    if (res.decision === 'accept') return { behavior: 'allow', updatedInput: input }
    if (res.decision === 'acceptForSession')
      return { behavior: 'allow', updatedInput: input, updatedPermissions: opts.suggestions }
    declined.add(opts.toolUseID)
    return {
      behavior: 'deny',
      message: 'The user declined this action.',
      interrupt: res.decision === 'cancel'
    }
  }

  const handle = (m: SDKMessage) => {
    if (m.type === 'system' && m.subtype === 'init') {
      t.hasSession = true
      return
    }
    if (m.type === 'stream_event') {
      if (m.parent_tool_use_id) return
      const e: any = m.event
      if (e.type === 'message_start') {
        streamedMessages.add(e.message.id)
      } else if (e.type === 'content_block_start' && e.content_block?.type === 'text') {
        live = { id: randomUUID(), text: '' }
        ev('item/started', { item: { type: 'agentMessage', id: live.id, text: '', phase: null }, startedAtMs: Date.now() })
      } else if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta' && live) {
        live.text += e.delta.text
        ev('item/agentMessage/delta', { itemId: live.id, delta: e.delta.text })
      } else if (e.type === 'content_block_stop' && live) {
        ev('item/completed', {
          item: { type: 'agentMessage', id: live.id, text: live.text, phase: null },
          completedAtMs: Date.now()
        })
        live = null
      }
      return
    }
    if (m.type === 'assistant') {
      if (m.parent_tool_use_id) return
      if (m.error) error = `Claude error: ${m.error}`
      const streamed = streamedMessages.has(m.message.id)
      for (const block of m.message.content as any[]) {
        if (block.type === 'tool_use') startTool(block.id, block.name, block.input)
        else if (block.type === 'text' && !streamed && block.text) {
          const item: ThreadItem = { type: 'agentMessage', id: randomUUID(), text: block.text, phase: null }
          ev('item/started', { item, startedAtMs: Date.now() })
          ev('item/completed', { item, completedAtMs: Date.now() })
        }
      }
      return
    }
    if (m.type === 'user') {
      if (m.parent_tool_use_id) return
      const content = (m.message as any).content
      if (!Array.isArray(content)) return
      for (const block of content) {
        if (block?.type !== 'tool_result') continue
        const entry = tools.get(block.tool_use_id)
        if (!entry) continue
        const done = completeItem(
          entry.item,
          textOf(block.content),
          !!block.is_error,
          declined.has(block.tool_use_id),
          Date.now() - entry.startedAt
        )
        tools.delete(block.tool_use_id)
        ev('item/completed', { item: done, completedAtMs: Date.now() })
      }
      return
    }
    if (m.type === 'result') {
      if (m.subtype !== 'success') {
        isErrorResult = true
        error = error ?? `Turn ended: ${m.subtype}`
      } else if (m.is_error) {
        isErrorResult = true
        error = error ?? m.result
      }
    }
  }

  const mode = permissionModeFor(t.approvalPolicy, t.sandbox)
  try {
    const q = query({
      prompt: text,
      options: {
        cwd: t.cwd,
        model: t.model,
        effort,
        permissionMode: mode,
        allowDangerouslySkipPermissions: mode === 'bypassPermissions',
        canUseTool,
        includePartialMessages: true,
        abortController: abort,
        settingSources: ['user', 'project', 'local'],
        systemPrompt: { type: 'preset', preset: 'claude_code' },
        ...(t.hasSession ? { resume: t.id } : { sessionId: t.id }),
        stderr: (d) => process.stderr.write(d)
      }
    })
    for await (const m of q) handle(m)
  } catch (e) {
    if (!abort.signal.aborted) error = (e as Error)?.message ?? String(e)
  }

  // Close out anything left open (interrupts, crashes).
  for (const { item, startedAt } of tools.values()) {
    const closed = completeItem(item, '', true, abort.signal.aborted, Date.now() - startedAt)
    ev('item/completed', { item: closed, completedAtMs: Date.now() })
  }
  if (live) {
    const l = live as { id: string; text: string }
    ev('item/completed', { item: { type: 'agentMessage', id: l.id, text: l.text, phase: null }, completedAtMs: Date.now() })
  }

  const status = abort.signal.aborted ? 'interrupted' : error || isErrorResult ? 'failed' : 'completed'
  if (status === 'failed' && error) {
    ev('error', { error: { message: error, additionalDetails: null }, willRetry: false })
  }
  t.active = undefined
  peer.notify('turn/completed', {
    threadId,
    turn: {
      ...turn,
      status,
      error: status === 'failed' ? { message: error ?? 'Turn failed', additionalDetails: null } : null,
      completedAt: now(),
      durationMs: Date.now() - started
    } satisfies Turn
  })
}

process.stdin.on('end', () => process.exit(0))
