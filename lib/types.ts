/*
  Domain model for the whole app. Every feature imports from here.
  Keep this file dependency-free (types + plain constants only).
*/

export type ID = string;

export type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "canceled";

export type Priority = "none" | "urgent" | "high" | "medium" | "low";

export type OkrHealth = "on_track" | "at_risk" | "off_track";

export type Role = "Admin" | "Member";

export interface Workspace {
  name: string;
  /** Issue key prefix, e.g. XO in XO-42 */
  teamKey: string;
  teamName: string;
  /** Workspace avatar color, hex */
  color: string;
}

export interface Member {
  id: ID;
  name: string;
  email: string;
  role: Role;
  /** Avatar color, hex */
  color: string;
  /** ISO date */
  joinedAt: string;
}

export interface Label {
  id: ID;
  name: string;
  /** Dot color, hex */
  color: string;
}

export interface Sprint {
  id: ID;
  number: number;
  name: string;
  goal?: string;
  /** ISO dates, inclusive */
  startDate: string;
  endDate: string;
}

export type KrStatus = "on_track" | "at_risk" | "off_track" | "done";

export interface KeyResult {
  id: ID;
  name: string;
  current: number;
  target: number;
  /** Display unit, e.g. "%" or "min" */
  unit?: string;
  status: KrStatus;
  /**
   * Which way progress runs, fixed at creation (a lower-is-better KR
   * stays lower-is-better after beating its target). Inferred from the
   * initial values when omitted.
   */
  direction?: "increase" | "decrease";
}

/** One entry in an objective's activity history, newest first. */
export interface ObjectiveEvent {
  id: ID;
  /** Full ISO datetime */
  at: string;
  memberId: ID | null;
  /** Human readable, e.g. Updated "Activation rate": 31 to 34 % */
  summary: string;
}

export interface Objective {
  id: ID;
  name: string;
  description?: string;
  ownerId: ID;
  health: OkrHealth;
  /** ISO date */
  targetDate: string;
  keyResults: KeyResult[];
  history: ObjectiveEvent[];
  createdAt: string;
}

/** A selected folder under the XO root. Issues can belong to one. */
export interface Project {
  id: ID;
  name: string;
  /** Folder name under the XO root, or "" for the root itself */
  folder: string;
  /** Dot color, hex */
  color: string;
}

/** Where a mirrored issue came from on disk. */
export interface IssueOrigin {
  kind: "agent_todo" | "work_item";
  /** Absolute path of the .xo file the issue was read from */
  sourcePath: string;
  sessionId?: string;
}

export interface Issue {
  id: ID;
  /** Sequential per workspace; rendered as `${teamKey}-${number}` */
  number: number;
  title: string;
  description?: string;
  status: IssueStatus;
  priority: Priority;
  assigneeId?: ID | null;
  labelIds: ID[];
  projectId?: ID | null;
  sprintId?: ID | null;
  objectiveId?: ID | null;
  estimate?: number | null;
  /** ISO date */
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Set on issues mirrored from .xo files; absent on locally created ones */
  origin?: IssueOrigin;
}

export interface WikiDoc {
  id: ID;
  title: string;
  /** Markdown subset (see docs/DESIGN.md, Prose recipe), edited as plain text */
  content: string;
  /** Null when the author was removed from the workspace */
  authorId: ID | null;
  createdAt: string;
  updatedAt: string;
}

/* XO integration: the app mirrors todos and work items from .xo folders
   on disk (read only). See docs/ARCHITECTURE.md, "XO data layer". */

/** One top level folder under the XO root, as listed by /api/xo/folders. */
export interface XoFolder {
  name: string;
  /** True when the folder has its own .xo directory */
  hasXo: boolean;
}

/** Client side settings for the XO mirror, persisted to localStorage. */
export interface XoConfig {
  /** Absolute path of the XO root; null means use the server default */
  root: string | null;
  /** Folder names selected as projects in Setup */
  projects: string[];
}

/** Per source counts, for the Setup dialog and diagnostics. */
export interface XoSourceSummary {
  /** Folder name relative to the root, "" for the root itself */
  folder: string;
  todoCount: number;
  workItemCount: number;
}

/** Everything /api/xo/snapshot returns. Mirror slices of the app store. */
export interface XoSnapshot {
  root: string;
  workspace: Workspace;
  members: Member[];
  labels: Label[];
  projects: Project[];
  issues: Issue[];
  currentMemberId: ID;
  sources: XoSourceSummary[];
  /** PRD.md content from the app directory, mirrored into the wiki */
  prd: string | null;
  generatedAt: string;
}

/* Display metadata. Order here is the canonical sort and grouping order. */

export const STATUSES: { id: IssueStatus; label: string }[] = [
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "todo", label: "Todo" },
  { id: "backlog", label: "Backlog" },
  { id: "done", label: "Done" },
  { id: "canceled", label: "Canceled" },
];

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "none", label: "No priority" },
  { id: "urgent", label: "Urgent" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

export const HEALTH: { id: OkrHealth; label: string }[] = [
  { id: "on_track", label: "On track" },
  { id: "at_risk", label: "At risk" },
  { id: "off_track", label: "Off track" },
];

export const KR_STATUSES: { id: KrStatus; label: string }[] = [
  { id: "on_track", label: "On track" },
  { id: "at_risk", label: "At risk" },
  { id: "off_track", label: "Off track" },
  { id: "done", label: "Done" },
];

export const krStatusLabel = (s: KrStatus) =>
  KR_STATUSES.find((x) => x.id === s)?.label ?? s;

export const statusLabel = (s: IssueStatus) =>
  STATUSES.find((x) => x.id === s)?.label ?? s;

export const priorityLabel = (p: Priority) =>
  PRIORITIES.find((x) => x.id === p)?.label ?? p;

export const healthLabel = (h: OkrHealth) =>
  HEALTH.find((x) => x.id === h)?.label ?? h;

export const ESTIMATES = [1, 2, 3, 5, 8] as const;
