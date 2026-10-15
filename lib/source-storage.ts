import "server-only";

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { SESSION_RE } from "@/components/activity/shared";
import { HISTORY_DIR, sessionIds } from "./activity";
import { resolveDbDir } from "./db/pglite";
import { PROJECT_ROOT } from "./project-root";
import { remoteActivityFields, type RemoteConfig } from "./remote-config";
import { homeLabel, remoteConnected, remoteDatabase, remoteLabel } from "./storage";
import { localSourceConfig, LOCAL_INDEX_FILE, readRemoteConfig, readSourceSelection, remoteIndexFile, REMOTE_CACHE_DIR, SOURCE_CONFIG_FILE } from "./sources";

// What Sources shows: the input (local folders, GitHub repositories), everything that
// input generates, one short row each with a relative path, its size and when it last
// changed, and the databases its copy is kept in.

export interface GeneratedItem {
  id: string;
  label: string;
  path: string; // as a person reads it: relative to the app ("data/index.json") or to home ("~/.innernet/db")
  kind: "file" | "directory" | "browser";
  exists: boolean;
  bytes: number | null;
  /** True when the size stopped counting at the walk's budget: "at least". */
  more: boolean;
  modified: string | null; // ISO
  /** A few words: "12 sessions", "in use". */
  detail: string | null;
  editable: boolean;
}

/** The locations the open route may act on, by id; never a path from a request. */
interface Location {
  id: string;
  abs: string;
  kind: "file" | "directory";
  editable: boolean;
}

/** A path as Sources shows it: inside the app, relative to it; under home, from ~. */
export function shownPath(abs: string): string {
  const rel = path.relative(PROJECT_ROOT, abs);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return rel.split(path.sep).join("/");
  return homeLabel(abs);
}

/** Size, file count and newest change of a file or folder, never through a link, and
 * never more than `budget` entries (a clone cache can be large). */
function measure(abs: string, budget = 40_000): { exists: boolean; bytes: number; more: boolean; newest: number } {
  let st: fs.Stats;
  try {
    st = fs.lstatSync(abs);
  } catch {
    return { exists: false, bytes: 0, more: false, newest: 0 };
  }
  if (st.isFile()) return { exists: true, bytes: st.size, more: false, newest: st.mtimeMs };
  if (!st.isDirectory()) return { exists: true, bytes: 0, more: false, newest: 0 };
  let bytes = 0;
  let newest = st.mtimeMs;
  let left = budget;
  const stack = [abs];
  while (stack.length && left > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (--left <= 0) break;
      if (e.isSymbolicLink()) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) {
        try {
          const f = fs.statSync(p);
          bytes += f.size;
          newest = Math.max(newest, f.mtimeMs);
        } catch {
          /* gone */
        }
      }
    }
  }
  return { exists: true, bytes, more: left <= 0, newest };
}

const iso = (ms: number) => (ms > 0 ? new Date(ms).toISOString() : null);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** The named locations. The tab's own history file only when the tab's session is known. */
function locations(session: string | null): Location[] {
  if (session !== null && !SESSION_RE.test(session)) throw new Error("Bad session id.");
  let remote: RemoteConfig | null = null;
  try {
    remote = readRemoteConfig();
  } catch {
    /* repairable on the page */
  }
  const snapshot = remote ? remoteIndexFile(remote) : null;
  const out: Location[] = [
    { id: "local-index", abs: LOCAL_INDEX_FILE, kind: "file", editable: false },
    { id: "history", abs: HISTORY_DIR, kind: "directory", editable: false },
    ...(session ? [{ id: "session", abs: path.join(HISTORY_DIR, session, "innernet.jsonl"), kind: "file" as const, editable: true }] : []),
    { id: "database", abs: resolveDbDir(), kind: "directory", editable: false },
    { id: "remote-cache", abs: REMOTE_CACHE_DIR, kind: "directory", editable: false },
    { id: "config", abs: SOURCE_CONFIG_FILE, kind: "file", editable: true },
  ];
  if (snapshot) out.splice(1, 0, { id: "remote-index", abs: snapshot, kind: "file", editable: false });
  return out;
}

/** Everything the input generates, in the order it is made. Without a session, the tab's
 * own history file is left out (the page draws that row in the browser, which knows it). */
export function generatedData(session: string | null): GeneratedItem[] {
  const items: GeneratedItem[] = [];
  for (const loc of locations(session)) {
    if (loc.id === "config") continue; // input, shown with the folders it names
    const m = measure(loc.abs);
    let label = "";
    let detail: string | null = null;
    switch (loc.id) {
      case "local-index":
        label = "Local index";
        detail = "pages from your folders";
        break;
      case "remote-index":
        label = "GitHub snapshot";
        detail = m.exists ? "pages from your repositories" : "made by the next sync";
        break;
      case "history": {
        label = "History";
        const n = m.exists ? sessionIds().length : 0;
        detail = n ? plural(n, "session") : "one folder per tab";
        break;
      }
      case "session":
        label = "This tab";
        detail = "its history file";
        break;
      case "database":
        label = "Local database";
        detail = "a copy of the index and history";
        break;
      case "remote-cache":
        label = "GitHub clones";
        detail = "used by sync";
        break;
    }
    items.push({
      id: loc.id,
      label,
      path: shownPath(loc.abs),
      kind: loc.kind,
      exists: m.exists,
      bytes: m.exists ? m.bytes : null,
      more: m.more,
      modified: m.exists ? iso(m.newest) : null,
      detail,
      editable: loc.editable,
    });
  }
  items.push({
    id: "browser",
    label: "This browser",
    path: "sessionStorage, localStorage",
    kind: "browser",
    exists: true,
    bytes: null,
    more: false,
    modified: null,
    detail: "session, trail, theme",
    editable: false,
  });
  return items;
}

/** The Input and Storage sections, and the generated data between them. Without a
 * session (the page renders on the server), the tab's own history file is left out. */
export function sourceInfo(session: string | null) {
  let remote: RemoteConfig | null = null;
  let remoteError: string | undefined;
  try {
    remote = readRemoteConfig();
  } catch (error) {
    remoteError = error instanceof Error ? error.message : "The saved repositories could not be read. Enter them again and save.";
  }
  const snapshot = remote ? remoteIndexFile(remote) : null;
  let generatedAt: string | null = null;
  let pages: number | null = null;
  try {
    if (snapshot) {
      const meta = JSON.parse(fs.readFileSync(snapshot, "utf8")).meta;
      generatedAt = meta.generatedAt ?? null;
      pages = typeof meta.counts?.pages === "number" ? meta.counts.pages : null;
    }
  } catch {
    /* not synced yet */
  }
  let local: { roots: string[]; maxDepth: number | null; config: string; error?: string };
  try {
    const config = localSourceConfig();
    local = { roots: config.roots.map(homeLabel), maxDepth: config.maxDepth, config: shownPath(SOURCE_CONFIG_FILE) };
  } catch {
    local = { roots: [], maxDepth: null, config: shownPath(SOURCE_CONFIG_FILE), error: "The folder settings could not be read. Edit them, then reload." };
  }
  const db = remoteDatabase();
  return {
    selection: readSourceSelection(),
    local,
    remote: {
      repositories: remote?.repositories ?? [],
      legacyAccount: remote?.legacyAccount ?? null,
      snapshot: snapshot ? shownPath(snapshot) : null,
      generatedAt,
      pages,
      needsSync: !!snapshot && !generatedAt,
      ...(remoteError ? { error: remoteError } : {}),
    },
    generated: generatedData(session),
    storage: {
      local: { path: shownPath(resolveDbDir()) },
      remote: { configured: !!db, connected: !!db && remoteConnected(), label: db ? remoteLabel(db) : "Not set up" },
    },
  };
}

/** For activity lines about the remote input. */
export const remoteSummary = (remote: RemoteConfig) => remoteActivityFields(remote);

/** Only named app locations may be opened, never a caller-supplied path or command. */
export async function openStorageLocation(session: string, target: string, action: "reveal" | "edit"): Promise<void> {
  if (!SESSION_RE.test(session)) throw new Error("Bad session id.");
  const item = locations(session).find((entry) => entry.id === target);
  if (!item) throw new Error("Unknown storage location.");
  const exists = fs.existsSync(item.abs);
  if (action === "edit" && (!item.editable || item.kind !== "file" || !exists)) throw new Error("This file is not available to edit. Open its folder instead.");
  if (target === "session" && exists) {
    const root = fs.realpathSync(HISTORY_DIR);
    const file = fs.realpathSync(item.abs);
    if (!file.startsWith(root + path.sep)) throw new Error("The activity file is outside the history folder.");
  }
  let destination = action === "edit" ? item.abs : item.kind === "file" ? path.dirname(item.abs) : item.abs;
  if (action === "reveal") {
    while (!fs.existsSync(destination)) {
      const parent = path.dirname(destination);
      if (parent === destination) throw new Error("This storage folder is not available.");
      destination = parent;
    }
  }
  const platform = process.platform;
  const command = platform === "win32" ? (action === "edit" ? "notepad.exe" : "explorer.exe") : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "darwin" && action === "edit" ? ["-t", destination] : [destination];
  await new Promise<void>((resolve, reject) => {
    // This is a visible editor or folder window explicitly requested by its button.
    const child = spawn(command, args, { shell: false, stdio: "ignore", detached: true, windowsHide: false });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
