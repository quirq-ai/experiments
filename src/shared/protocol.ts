// The subset of the Codex app-server protocol (v2) that Workbench speaks.
// Shapes mirror `codex app-server generate-ts` output (codex-cli 0.160.1).
// Both engines implement this contract:
//   codex  -> `codex app-server` (native)
//   claude -> src/claude-app-server (Claude Agent SDK behind the same wire format)
// Wire format: newline-delimited JSON-RPC 2.0 without the "jsonrpc" field.

export type RequestId = string | number

export interface RpcRequest<P = unknown> {
  id: RequestId
  method: string
  params?: P
}
export interface RpcNotification<P = unknown> {
  method: string
  params?: P
}
export interface RpcResponse<R = unknown> {
  id: RequestId
  result?: R
  error?: { code: number; message: string; data?: unknown }
}
export type RpcMessage = RpcRequest | RpcNotification | RpcResponse

// ---- initialize -----------------------------------------------------------

export interface InitializeParams {
  clientInfo: { name: string; title: string | null; version: string }
  capabilities: { experimentalApi: boolean; requestAttestation: boolean } | null
}
export interface InitializeResponse {
  userAgent: string
  codexHome: string
  platformFamily: string
  platformOs: string
}

// ---- models ----------------------------------------------------------------

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra'

export interface Model {
  id: string
  model: string
  displayName: string
  description: string
  hidden: boolean
  supportedReasoningEfforts: { reasoningEffort: ReasoningEffort; description: string }[]
  defaultReasoningEffort: ReasoningEffort
  isDefault: boolean
}
export interface ModelListResponse {
  data: Model[]
  nextCursor: string | null
}

// ---- threads and turns -----------------------------------------------------

export type AskForApproval = 'untrusted' | 'on-request' | 'never'
export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'

export interface ThreadStartParams {
  model?: string | null
  cwd?: string | null
  approvalPolicy?: AskForApproval | null
  sandbox?: SandboxMode | null
}
export interface ThreadResumeParams extends ThreadStartParams {
  threadId: string
  excludeTurns?: boolean
}

export type TurnStatus = 'completed' | 'interrupted' | 'failed' | 'inProgress'
export interface TurnError {
  message: string
  additionalDetails: string | null
}
export interface Turn {
  id: string
  items: ThreadItem[]
  status: TurnStatus
  error: TurnError | null
  startedAt: number | null
  completedAt: number | null
  durationMs: number | null
}

export interface Thread {
  id: string
  preview: string
  model: string | null
  createdAt: number
  updatedAt: number
  cwd: string
  name: string | null
  turns: Turn[]
}
export interface ThreadStartResponse {
  thread: Thread
  model: string
  cwd: string
  approvalPolicy: AskForApproval
  reasoningEffort: ReasoningEffort | null
}

export type UserInput = { type: 'text'; text: string; text_elements: [] }

export interface TurnStartParams {
  threadId: string
  input: UserInput[]
  cwd?: string | null
  approvalPolicy?: AskForApproval | null
  sandboxPolicy?: SandboxPolicy | null
  model?: string | null
  effort?: ReasoningEffort | null
}
export type SandboxPolicy =
  | { type: 'readOnly'; networkAccess: boolean }
  | {
      type: 'workspaceWrite'
      writableRoots: string[]
      networkAccess: boolean
      excludeTmpdirEnvVar: boolean
      excludeSlashTmp: boolean
    }
  | { type: 'dangerFullAccess' }

export interface TurnStartResponse {
  turn: Turn
}
export interface TurnInterruptParams {
  threadId: string
  turnId: string
}

// ---- items -----------------------------------------------------------------

export type ItemStatus = 'inProgress' | 'completed' | 'failed' | 'declined'

export interface FileUpdateChange {
  path: string
  kind: { type: 'add' } | { type: 'delete' } | { type: 'update'; move_path: string | null }
  diff: string
}

export type ThreadItem =
  | { type: 'userMessage'; id: string; clientId: string | null; content: UserInput[] }
  | { type: 'agentMessage'; id: string; text: string; phase: string | null }
  | { type: 'reasoning'; id: string; summary: string[]; content: string[] }
  | { type: 'plan'; id: string; text: string }
  | {
      type: 'commandExecution'
      id: string
      command: string
      cwd: string
      status: ItemStatus
      aggregatedOutput: string | null
      exitCode: number | null
      durationMs: number | null
    }
  | { type: 'fileChange'; id: string; changes: FileUpdateChange[]; status: ItemStatus }
  | {
      type: 'mcpToolCall'
      id: string
      server: string
      tool: string
      status: 'inProgress' | 'completed' | 'failed'
      arguments: unknown
      error: { message: string } | null
    }
  | {
      type: 'dynamicToolCall'
      id: string
      namespace: string | null
      tool: string
      arguments: unknown
      status: 'inProgress' | 'completed' | 'failed'
      contentItems: { type: 'inputText'; text: string }[] | null
      success: boolean | null
      durationMs: number | null
    }
  | { type: 'webSearch'; id: string; query?: string }
  | { type: 'contextCompaction'; id: string }
  // Any item type Workbench does not render specially.
  | { type: `other:${string}`; id: string }

// ---- notifications (server -> client) --------------------------------------

export interface ItemNotification {
  item: ThreadItem
  threadId: string
  turnId: string
}
export interface DeltaNotification {
  threadId: string
  turnId: string
  itemId: string
  delta: string
}
export interface TurnNotification {
  threadId: string
  turn: Turn
}
export interface ErrorNotification {
  error: TurnError
  willRetry: boolean
  threadId: string
  turnId: string
}

// ---- approvals (server -> client requests) ---------------------------------

export interface CommandExecutionRequestApprovalParams {
  threadId: string
  turnId: string
  itemId: string
  reason?: string | null
  command?: string | null
  cwd?: string | null
}
export interface FileChangeRequestApprovalParams {
  threadId: string
  turnId: string
  itemId: string
  reason?: string | null
  grantRoot?: string | null
}
export type ApprovalDecision = 'accept' | 'acceptForSession' | 'decline' | 'cancel'

export const APPROVAL_METHODS = [
  'item/commandExecution/requestApproval',
  'item/fileChange/requestApproval'
] as const
export type ApprovalMethod = (typeof APPROVAL_METHODS)[number]
