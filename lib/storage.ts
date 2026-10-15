import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The remote database Innernet can connect to, beside this machine's own (PGlite in
// ~/.innernet/db, always in use). Connected, the two are kept in step both ways (see
// lib/db/remote-sync.ts): what this machine makes goes up, and history from your other
// machines comes down into the history folders, which stay the record.
//
// Both settings live in ~/.innernet, beside the history and the database, outside the
// project, so neither git nor a deploy ever carries them:
//   storage.json  { "connected": true }                  whether the remote is connected
//   remote.json   { "url": "postgres://...", ... }       the remote database (a secret)
// INNERNET_REMOTE (on or off) and INNERNET_REMOTE_DATABASE_URL override them;
// INNERNET_HOME moves the folder. The public demo never reads any of this.

export interface RemoteDatabase {
  url: string;
  provider: string | null; // "neon"
  name: string | null; // "innernet-personal"
}

const home = (p: string) => (p === "~" ? os.homedir() : p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p);

export const STATE_DIR = path.resolve(home(process.env.INNERNET_HOME?.trim() || path.join(os.homedir(), ".innernet")));
export const STORAGE_FILE = path.join(STATE_DIR, "storage.json");
export const REMOTE_FILE = path.join(STATE_DIR, "remote.json");

const POSTGRES_URL = /^postgres(?:ql)?:\/\/[^\s]+$/;

/** Whether the remote database is connected: the settings say so, or INNERNET_REMOTE. */
export function remoteConnected(): boolean {
  const forced = process.env.INNERNET_REMOTE?.trim().toLowerCase();
  if (forced === "on" || forced === "off") return forced === "on";
  try {
    const saved = JSON.parse(fs.readFileSync(STORAGE_FILE, "utf8")) as { connected?: unknown };
    return saved?.connected === true;
  } catch {
    return false;
  }
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** The remote database, if one is set up. Its URL is a secret: never logged, never sent
 * to a browser, never written anywhere but remote.json. */
export function remoteDatabase(): RemoteDatabase | null {
  const forced = process.env.INNERNET_REMOTE_DATABASE_URL?.trim();
  if (forced) return POSTGRES_URL.test(forced) ? { url: forced, provider: null, name: null } : null;
  try {
    const saved = JSON.parse(fs.readFileSync(REMOTE_FILE, "utf8")) as Record<string, unknown>;
    const url = text(saved?.url);
    if (url && POSTGRES_URL.test(url)) return { url, provider: text(saved.provider), name: text(saved.name) };
  } catch {
    /* none set up */
  }
  return null;
}

/** For people: "innernet-personal on Neon, us-east-1". Never a password, user or full host. */
export function remoteLabel(remote: RemoteDatabase | null): string {
  if (!remote) return "no remote database";
  let host = "";
  try {
    host = new URL(remote.url).hostname;
  } catch {
    /* unreadable: the name alone */
  }
  const neon = remote.provider === "neon" || host.endsWith(".neon.tech");
  const region = host.match(/\.(?:[a-z]-\d+\.)?([a-z]{2}-[a-z]+-\d)\./)?.[1] ?? null;
  const where = [neon ? "Neon" : "Postgres", region].filter(Boolean).join(", ");
  return remote.name ? `${remote.name} on ${where}` : `your ${where} database`;
}

/** Save whether the remote is connected: ~/.innernet/storage.json, folder 700, file 600, written whole. */
export function writeRemoteConnected(connected: boolean): void {
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
  const tmp = `${STORAGE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ connected }, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, STORAGE_FILE);
}

/** "~/.innernet/storage.json" for a path under the home folder, the path otherwise. */
export function homeLabel(p: string): string {
  const h = os.homedir();
  return p === h ? "~" : p.startsWith(h + path.sep) ? `~${p.slice(h.length)}` : p;
}
