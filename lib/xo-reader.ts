import { promises as fs } from "node:fs";
import path from "node:path";
import { AVATAR_COLORS, LABEL_COLORS, XO_LABELS, fallbackWorkspace } from "./seed";
import type {
  ID,
  Issue,
  IssueStatus,
  Member,
  Project,
  XoFolder,
  XoSnapshot,
  XoSourceSummary,
} from "./types";

/*
  Server only: reads .xo state files from disk and maps them into the app
  domain. Imported exclusively by the /api/xo route handlers; never import
  this from a client component. The mirror is read only: nothing here ever
  writes to a .xo file.

  Sources per .xo directory:
  - todos.json       agent session todos ({ sessions: { <id>: { todos } } })
  - work-items.json  workspace operator work items ({ items })

  The XO root is resolved in this order: explicit ?root= query, the
  XO_ROOT environment variable, then the topmost ancestor of the app that
  contains a .xo directory.
*/

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".pnpm-store"]);

interface RawTodo {
  id?: string;
  content?: string;
  description?: string;
  status?: string;
}

interface RawTodoSession {
  session_started_at?: string;
  todos?: RawTodo[];
}

interface RawTodosFile {
  sessions?: Record<string, RawTodoSession>;
}

interface RawWorkItem {
  id?: string;
  project_id?: string;
  content?: string;
  description?: string;
  status?: string;
  owner?: string | null;
  creator?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface RawWorkItemsFile {
  items?: RawWorkItem[];
}

interface RawProjectFile {
  name?: string;
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** Topmost ancestor of cwd that contains a .xo directory, else null. */
async function findAncestorRoot(): Promise<string | null> {
  let dir = process.cwd();
  let found: string | null = null;
  for (;;) {
    if (await isDir(path.join(dir, ".xo"))) found = dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return found;
}

export async function resolveRoot(requested?: string | null): Promise<string> {
  if (requested && (await isDir(requested))) return path.resolve(requested);
  if (requested) throw new Error(`Not a directory: ${requested}`);
  const env = process.env.XO_ROOT;
  if (env && (await isDir(env))) return path.resolve(env);
  const ancestor = await findAncestorRoot();
  if (ancestor) return ancestor;
  return process.cwd();
}

/** Top level folders under the root, with a flag for their own .xo dir. */
export async function listFolders(root: string): Promise<XoFolder[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const folders: XoFolder[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    folders.push({
      name: entry.name,
      hasXo: await isDir(path.join(root, entry.name, ".xo")),
    });
  }
  return folders.sort((a, b) => a.name.localeCompare(b.name));
}

const ISO_FALLBACK = "2026-01-01";

const isoDate = (value?: string): string =>
  value && value.length >= 10 ? value.slice(0, 10) : ISO_FALLBACK;

const mapStatus = (status?: string): IssueStatus => {
  if (status === "completed") return "done";
  if (status === "in_progress") return "in_progress";
  if (status === "pending") return "todo";
  return "backlog";
};

const hashPick = (value: string, size: number): number => {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h % size;
};

const slug = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";

const [LABEL_AGENT_TODO, LABEL_WORK_ITEM] = XO_LABELS;

interface PendingIssue {
  id: ID;
  title: string;
  description: string;
  status: IssueStatus;
  assigneeId: ID | null;
  labelIds: ID[];
  projectId: ID | null;
  createdAt: string;
  updatedAt: string;
  origin: Issue["origin"];
}

export async function readSnapshot(
  requestedRoot?: string | null,
  selectedProjects: string[] = []
): Promise<XoSnapshot> {
  const root = await resolveRoot(requestedRoot);

  const members = new Map<string, Member>();
  const ensureMember = (name: string): ID => {
    const id = `m-${slug(name)}`;
    if (!members.has(id)) {
      members.set(id, {
        id,
        name,
        email: `${slug(name)}@local`,
        role: members.size === 0 ? "Admin" : "Member",
        color: AVATAR_COLORS[hashPick(name, AVATAR_COLORS.length)],
        joinedAt: ISO_FALLBACK,
      });
    }
    return id;
  };
  const operatorId = ensureMember("Workspace operator");

  const projects = new Map<string, Project>();
  const ensureProject = (folder: string, name: string): ID => {
    const id = folder === "" ? "p-workspace" : `p-${slug(folder)}`;
    if (!projects.has(id)) {
      projects.set(id, {
        id,
        name,
        folder,
        color: LABEL_COLORS[hashPick(folder || name, LABEL_COLORS.length)],
      });
    }
    return id;
  };

  const pending: PendingIssue[] = [];
  const sources: XoSourceSummary[] = [];
  const selected = new Set(selectedProjects);

  const readXoDir = async (folder: string): Promise<void> => {
    const xoDir = folder === "" ? path.join(root, ".xo") : path.join(root, folder, ".xo");
    if (!(await isDir(xoDir))) return;

    const summary: XoSourceSummary = { folder, todoCount: 0, workItemCount: 0 };
    const homeProjectId = ensureProject(
      folder,
      folder === "" ? "Workspace" : folder
    );

    const todosPath = path.join(xoDir, "todos.json");
    const todosFile = await readJson<RawTodosFile>(todosPath);
    for (const [sessionId, session] of Object.entries(todosFile?.sessions ?? {})) {
      const createdAt = isoDate(session.session_started_at);
      for (const todo of session.todos ?? []) {
        if (!todo.content) continue;
        summary.todoCount += 1;
        pending.push({
          id: `xo-t-${slug(sessionId).slice(0, 8)}-${slug(todo.id ?? String(summary.todoCount))}`,
          title: todo.content,
          description: todo.description ?? "",
          status: mapStatus(todo.status),
          assigneeId: operatorId,
          labelIds: [LABEL_AGENT_TODO.id],
          projectId: homeProjectId,
          createdAt,
          updatedAt: createdAt,
          origin: { kind: "agent_todo", sourcePath: todosPath, sessionId },
        });
      }
    }

    const itemsPath = path.join(xoDir, "work-items.json");
    const itemsFile = await readJson<RawWorkItemsFile>(itemsPath);
    for (const item of itemsFile?.items ?? []) {
      if (!item.content || !item.id) continue;
      summary.workItemCount += 1;
      // Root level work items carry a project_id; route them to that
      // project when it is selected, otherwise keep them on the source.
      const target =
        item.project_id && (selected.has(item.project_id) || folder === item.project_id)
          ? ensureProject(item.project_id, item.project_id)
          : homeProjectId;
      pending.push({
        id: `xo-w-${slug(item.id).slice(0, 12)}`,
        title: item.content,
        description: item.description ?? "",
        status: mapStatus(item.status),
        assigneeId: item.owner ? ensureMember(item.owner) : null,
        labelIds: [LABEL_WORK_ITEM.id],
        projectId: target,
        createdAt: isoDate(item.created_at),
        updatedAt: isoDate(item.updated_at ?? item.created_at),
        origin: { kind: "work_item", sourcePath: itemsPath },
      });
      if (item.creator) ensureMember(item.creator);
    }

    if (summary.todoCount > 0 || summary.workItemCount > 0) sources.push(summary);
  };

  await readXoDir("");
  for (const folder of selectedProjects) {
    if (/[\\/]|\.\./.test(folder)) continue;
    await readXoDir(folder);
    ensureProject(folder, folder);
  }

  pending.sort((a, b) =>
    a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)
  );
  const issues: Issue[] = pending.map((p, index) => ({
    ...p,
    number: index + 1,
    priority: "none",
    sprintId: null,
    objectiveId: null,
    estimate: null,
    dueDate: null,
  }));

  const rootProject = await readJson<RawProjectFile>(path.join(root, ".xo", "project.json"));

  // PRD.md lives in the app directory (not the XO root) and mirrors into
  // the wiki so the scope contract is readable inside the app.
  let prd: string | null = null;
  try {
    prd = await fs.readFile(path.join(process.cwd(), "PRD.md"), "utf8");
  } catch {
    prd = null;
  }

  return {
    root,
    workspace: {
      ...fallbackWorkspace,
      name: rootProject?.name ?? path.basename(root),
    },
    members: [...members.values()],
    labels: XO_LABELS,
    projects: [...projects.values()],
    issues,
    currentMemberId: operatorId,
    sources,
    prd,
    generatedAt: new Date().toISOString(),
  };
}
