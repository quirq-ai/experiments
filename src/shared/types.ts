// App-level types shared by main, preload and renderer.
import type {
  ApprovalDecision,
  ApprovalMethod,
  AskForApproval,
  Model,
  ReasoningEffort,
  SandboxPolicy
} from './protocol'

export type EngineId = 'codex' | 'claude'

export const ENGINES: { id: EngineId; label: string; server: string }[] = [
  { id: 'codex', label: 'Codex', server: 'codex app-server' },
  { id: 'claude', label: 'Claude', server: 'claude-app-server' }
]

export interface Project {
  path: string
  name: string
  addedAt: number
}

/** `${engine}:${threadId}`; thread ids are only unique within one engine. */
export type ThreadKey = string
export const threadKey = (engine: EngineId, id: string): ThreadKey => `${engine}:${id}`

export interface ThreadMeta {
  key: ThreadKey
  id: string
  engine: EngineId
  cwd: string
  title: string
  model: string
  createdAt: number
  updatedAt: number
}

export type Access = 'readonly' | 'ask' | 'agent' | 'full'

export const ACCESS: { id: Access; label: string; hint: string }[] = [
  { id: 'readonly', label: 'Read only', hint: 'Can read files; asks before any change' },
  { id: 'ask', label: 'Ask', hint: 'Asks before commands and edits' },
  { id: 'agent', label: 'Agent', hint: 'Edits in the workspace; asks for anything riskier' },
  { id: 'full', label: 'Full access', hint: 'Runs everything without asking' }
]

export function accessPolicy(a: Access): { approvalPolicy: AskForApproval; sandboxPolicy: SandboxPolicy } {
  const ws: SandboxPolicy = {
    type: 'workspaceWrite',
    writableRoots: [],
    networkAccess: false,
    excludeTmpdirEnvVar: false,
    excludeSlashTmp: false
  }
  switch (a) {
    case 'readonly':
      return { approvalPolicy: 'on-request', sandboxPolicy: { type: 'readOnly', networkAccess: false } }
    case 'ask':
      return { approvalPolicy: 'untrusted', sandboxPolicy: ws }
    case 'agent':
      return { approvalPolicy: 'on-request', sandboxPolicy: ws }
    case 'full':
      return { approvalPolicy: 'never', sandboxPolicy: { type: 'dangerFullAccess' } }
  }
}

export interface TurnSettings {
  model: string
  effort: ReasoningEffort | null
  access: Access
}

export interface ApprovalRequest {
  requestKey: string
  key: ThreadKey
  method: ApprovalMethod
  itemId: string
  command?: string | null
  reason?: string | null
}

export interface EngineStatus {
  engine: EngineId
  state: 'idle' | 'starting' | 'ready' | 'error'
  message?: string
  userAgent?: string
}

export interface GitDiff {
  isRepo: boolean
  branch?: string
  files: { path: string; status: string }[]
  patch: string
}

export type WorkbenchEvent =
  | { type: 'notification'; key: ThreadKey; method: string; params: any }
  | { type: 'approval'; request: ApprovalRequest }
  | { type: 'approval-resolved'; requestKey: string }
  | { type: 'thread-updated'; meta: ThreadMeta }
  | { type: 'engine-status'; status: EngineStatus }

export interface WorkbenchApi {
  listProjects(): Promise<Project[]>
  addProject(): Promise<Project | null>
  removeProject(path: string): Promise<void>
  listThreads(cwd: string): Promise<ThreadMeta[]>
  listModels(engine: EngineId): Promise<Model[]>
  engineStatus(): Promise<EngineStatus[]>
  createThread(engine: EngineId, cwd: string, settings: TurnSettings): Promise<ThreadMeta>
  deleteThread(key: ThreadKey): Promise<void>
  getTranscript(key: ThreadKey): Promise<import('./transcript').Transcript>
  send(key: ThreadKey, text: string, settings: TurnSettings): Promise<void>
  interrupt(key: ThreadKey): Promise<void>
  respondApproval(requestKey: string, decision: ApprovalDecision): Promise<void>
  pendingApprovals(): Promise<ApprovalRequest[]>
  gitDiff(cwd: string): Promise<GitDiff>
  onEvent(cb: (e: WorkbenchEvent) => void): () => void
}
