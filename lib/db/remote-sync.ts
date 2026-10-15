import "server-only";

import fs from "node:fs";
import path from "node:path";
import { HISTORY_DIR } from "../activity";
import { DEMO } from "../mode";
import { LOCAL_INDEX_FILE } from "../sources";
import { remoteConnected, remoteDatabase, remoteLabel } from "../storage";
import type { IndexMeta, Page, SiteIndex } from "../types";
import { insertActivity, writeHistoryLines, type ActivityRow } from "./activity";
import { getDb } from "./index";
import { loadIndex, storedIndexInfo } from "./index-store";
import { ingestHistory } from "./ingest";
import { errorText, say, sayOnce } from "./log";
import { openRemote } from "./neon";
import { bootstrap, epochMs, jsonParam } from "./schema";
import { forgottenUids } from "./tombstones";
import type { Db } from "./types";

// A connected remote database, kept in step with this machine, both ways. This machine's
// own database (PGlite) stays the one in use; the remote is a second copy that follows it
// and that your other machines can share.
//
//   up    the local index, when it is newer than the remote's, and every history line
//         the remote lacks
//   down  every history line the remote holds that this machine lacks, written into the
//         history folders (which stay the record) and taken into PGlite from there; and
//         the index, when this machine has none of its own yet
//   gone  history you deleted here (lib/db/tombstones.ts) is deleted there, and never
//         brought back down
//
// Nothing else is ever deleted remotely, so one machine never wipes another's history.
// A sync runs a few seconds after a new index or a new line of history, once a minute at
// most when the history page is read, on connecting, and on Sync now. One at a time.

export interface RemoteSync {
  at: string; // ISO
  ok: boolean;
  error?: string;
  /** up: this machine's newer index went up. down: the remote's came down (this machine had
   * none, or follows the remote). same: both hold one index. kept: this machine keeps its
   * own, older than the remote's (another machine's). none: no index on either side. */
  index: "up" | "down" | "same" | "kept" | "none";
  up: number; // history lines sent
  down: number; // history lines brought down into the folders
  removed: number; // lines deleted remotely because they were deleted here
  pages: number | null; // what the remote holds afterwards
  lines: number | null;
  ms: number;
}

interface State {
  db: Db | null;
  url: string | null;
  opening: Promise<Db | null> | null;
  running: Promise<RemoteSync> | null;
  timer: ReturnType<typeof setTimeout> | null;
  last: RemoteSync | null;
}

const G = globalThis as typeof globalThis & { __innernetRemote?: State };
const S = (G.__innernetRemote ??= { db: null, url: null, opening: null, running: null, timer: null, last: null });

const CHUNK = 1000;
const PULL_EVERY_MS = 60_000;

/** The connected remote database, open with its tables made, or null when none is connected. */
async function remoteDb(): Promise<Db | null> {
  if (DEMO || !remoteConnected()) return null;
  const config = remoteDatabase();
  if (!config) return null;
  if (S.db && S.url === config.url) return S.db;
  if (S.opening) return S.opening;
  S.opening = (async () => {
    const db = await openRemote(config, remoteLabel(config));
    await bootstrap(db);
    S.db = db;
    S.url = config.url;
    return db;
  })().finally(() => {
    S.opening = null;
  });
  return S.opening;
}

/** Reach the remote database set up in ~/.innernet/remote.json, connected or not: one query, timed. */
export async function reachRemote(): Promise<number> {
  const config = remoteDatabase();
  if (!config) throw new Error("No remote database is set up.");
  const started = Date.now();
  const db = await openRemote(config, remoteLabel(config));
  try {
    await db.query("SELECT 1 AS ok");
  } catch (err) {
    throw new Error(`${remoteLabel(config)} did not answer (${errorText(err)}).`);
  } finally {
    await db.close();
  }
  return Date.now() - started;
}

/** Let go of the remote database (on disconnecting). */
export function forgetRemote(): void {
  if (S.timer) clearTimeout(S.timer);
  S.timer = null;
  S.db = null;
  S.url = null;
  S.last = null;
}

const time = (iso: string | undefined | null) => {
  const t = Date.parse(iso ?? "");
  return Number.isNaN(t) ? -Infinity : t;
};

const chunks = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / CHUNK) }, (_, i) => xs.slice(i * CHUNK, (i + 1) * CHUNK));
const UID_LIST = "SELECT jsonb_array_elements_text($1::jsonb)";

function writeAtomic(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

/** Keep the last result, in memory and in this machine's database, for Sources to show. */
async function record(result: RemoteSync, local: Db | null): Promise<RemoteSync> {
  S.last = result;
  if (local) {
    await local
      .query("INSERT INTO kv (key, value, updated_at) VALUES ('remote.last', $1::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", [
        jsonParam(result),
      ])
      .catch(() => undefined);
  }
  return result;
}

const EMPTY = { index: "none" as const, up: 0, down: 0, removed: 0, pages: null, lines: null };

/** Pages per request: a remote database is reached over HTTPS, where one request carrying
 * a whole index (several MB) is asking for trouble. */
const PAGE_CHUNK = 400;
const KV_UPSERT = "INSERT INTO kv (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at";

/** Send an index up, its pages a few hundred at a time and its meta last: a reader trusts
 * the pages only once the meta counts them (loadIndex checks), so a sync cut short never
 * serves half an index. */
async function pushIndex(remote: Db, index: SiteIndex): Promise<void> {
  for (let i = 0; i < index.pages.length; i += PAGE_CHUNK) {
    await remote.query(
      "INSERT INTO pages (slug, pos, data, updated_at) " +
        "SELECT e->>'slug', ($2::int + n - 1)::int, e, now() FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS x(e, n) " +
        "ON CONFLICT (slug) DO UPDATE SET pos = excluded.pos, updated_at = excluded.updated_at, " +
        "data = CASE WHEN pages.data IS DISTINCT FROM excluded.data THEN excluded.data ELSE pages.data END " +
        "WHERE pages.data IS DISTINCT FROM excluded.data OR pages.pos IS DISTINCT FROM excluded.pos",
      [jsonParam(index.pages.slice(i, i + PAGE_CHUNK)), i],
    );
  }
  await remote.batch([
    { text: "DELETE FROM pages WHERE slug NOT IN (SELECT jsonb_array_elements_text($1::jsonb))", params: [jsonParam(index.pages.map((p) => p.slug))] },
    { text: KV_UPSERT, params: ["index.disambiguation", jsonParam(index.disambiguation ?? {})] },
    { text: KV_UPSERT, params: ["index.meta", jsonParam(index.meta)] },
  ]);
}

/** Bring an index down, a few hundred pages at a time, or null when there is none whole. */
async function pullIndex(remote: Db): Promise<SiteIndex | null> {
  const [metaRows, disRows] = await remote.batch([{ text: "SELECT value FROM kv WHERE key = 'index.meta'" }, { text: "SELECT value FROM kv WHERE key = 'index.disambiguation'" }], {
    readOnly: true,
  });
  const meta = metaRows[0]?.value as IndexMeta | undefined;
  if (!meta || typeof meta.generatedAt !== "string") return null;
  const pages: Page[] = [];
  for (let offset = 0; ; offset += PAGE_CHUNK) {
    const rows = await remote.query<{ data: Page }>("SELECT data FROM pages ORDER BY pos, slug LIMIT $1 OFFSET $2", [PAGE_CHUNK, offset]);
    pages.push(...rows.map((r) => r.data));
    if (rows.length < PAGE_CHUNK) break;
  }
  if (typeof meta.counts?.pages === "number" && meta.counts.pages !== pages.length) return null;
  return { meta, pages, disambiguation: (disRows[0]?.value ?? {}) as SiteIndex["disambiguation"] };
}

async function run(): Promise<RemoteSync> {
  const started = Date.now();
  const at = new Date(started).toISOString();
  let local: Db | null = null;
  try {
    const remote = await remoteDb();
    if (!remote) return { at, ok: false, error: "No remote database is connected.", ...EMPTY, ms: 0 };
    local = await getDb();
    if (!local) {
      return record({ at, ok: false, error: "This machine's database is not open just now, so the sync waits for it.", ...EMPTY, ms: Date.now() - started }, null);
    }
    const result = await syncBetween(local, remote, { indexFile: LOCAL_INDEX_FILE, historyDir: HISTORY_DIR });
    if (result.index !== "same" || result.up || result.down || result.removed) {
      say(`synced with the remote database: index ${result.index}, ${result.up} lines up, ${result.down} down, ${result.removed} removed, ${result.ms} ms`);
    }
    return record(result, local);
  } catch (err) {
    sayOnce(`remote:${errorText(err)}`, `could not sync with the remote database (${errorText(err)}); it is tried again on the next change`);
    return record({ at, ok: false, error: errorText(err), ...EMPTY, ms: Date.now() - started }, local);
  }
}

/**
 * One sync between this machine's database and a remote one, both open: the steps at the
 * top of this file. The scheduler above runs it; so do `pnpm db:store --remote` and the
 * tests, each with its own pair. Throws when a database does.
 */
export async function syncBetween(local: Db, remote: Db, where: { indexFile: string; historyDir: string }): Promise<RemoteSync> {
  if (local.kind !== "pglite" || remote.kind === "neon") throw new Error("a sync runs between this machine's database and your own remote one, never the demo's");
  const started = Date.now();
  const at = new Date(started).toISOString();
  // This machine's database first takes in whatever the history folders gained since it
  // last looked, so what goes up is everything the files hold.
  await ingestHistory(local, { dir: where.historyDir });

  // Gone: what was deleted here is deleted there.
  const forgotten = await forgottenUids(local);
  let removed = 0;
  for (const part of chunks([...forgotten])) {
    removed += (await remote.query(`DELETE FROM activity WHERE uid IN (${UID_LIST}) RETURNING uid`, [jsonParam(part)])).length;
  }

  // The index. This machine's own index goes up when it is the newer one. A machine with
  // none takes the remote's, and from then on follows it (meta.fromRemote): it takes the
  // remote's newer ones, and never sends one back up.
  let index: RemoteSync["index"] = "none";
  const [mine, theirs] = await Promise.all([storedIndexInfo(local), storedIndexInfo(remote)]);
  const newer = (a: IndexMeta, b: IndexMeta | undefined) => !b || time(a.generatedAt) > time(b.generatedAt);
  const follows = !!mine?.meta.fromRemote;
  if (mine && !mine.meta.demo && !follows && newer(mine.meta, theirs?.meta)) {
    const held = await loadIndex(local);
    if (held) {
      await pushIndex(remote, held);
      index = "up";
    }
  } else if (theirs && !theirs.meta.demo && (!fs.existsSync(where.indexFile) || (follows && newer(theirs.meta, mine?.meta)))) {
    const held = await pullIndex(remote);
    if (held) {
      held.meta.fromRemote = true;
      writeAtomic(where.indexFile, JSON.stringify(held));
      index = "down";
    }
  } else if (mine && theirs) index = mine.meta.generatedAt === theirs.meta.generatedAt ? "same" : "kept";

  // History, both ways, by the rows' uids (a hash of session, app and line).
  const [myRows, theirRows] = await Promise.all([local.query<{ uid: string }>("SELECT uid FROM activity"), remote.query<{ uid: string }>("SELECT uid FROM activity")]);
  const mineSet = new Set(myRows.map((r) => r.uid));
  const theirSet = new Set(theirRows.map((r) => r.uid));

  let up = 0;
  for (const part of chunks(myRows.map((r) => r.uid).filter((u) => !theirSet.has(u)))) {
    const rows = await local.query<{ uid: string; session: string; app: string; at: number; kind: string; data: Record<string, unknown>; line: string }>(
      `SELECT uid, session, app, ${epochMs("at")} AS at, kind, data, line FROM activity WHERE uid IN (${UID_LIST})`,
      [jsonParam(part)],
    );
    const out: ActivityRow[] = rows.map((r) => ({ ...r, at: new Date(Number(r.at)).toISOString() }));
    up += (await remote.batch(insertActivity(out))).reduce((n, r) => n + r.length, 0);
  }

  let down = 0;
  const wanted = [...theirSet].filter((u) => !mineSet.has(u) && !forgotten.has(u));
  if (wanted.length) {
    const lines: { session: string; app: string; line: string }[] = [];
    for (const part of chunks(wanted)) {
      lines.push(...(await remote.query<{ session: string; app: string; line: string }>(`SELECT session, app, line FROM activity WHERE uid IN (${UID_LIST}) AND line <> ''`, [jsonParam(part)])));
    }
    down = writeHistoryLines(where.historyDir, lines).appended;
    // The folders are the record: PGlite takes the new lines from them, as from any app.
    if (down) await ingestHistory(local, { dir: where.historyDir, only: [...new Set(lines.map((l) => l.session))] });
  }

  const [counts] = await remote.query<{ pages: number; lines: number }>("SELECT (SELECT count(*) FROM pages)::int AS pages, (SELECT count(*) FROM activity)::int AS lines");
  return { at, ok: true, index, up, down, removed, pages: Number(counts?.pages ?? 0), lines: Number(counts?.lines ?? 0), ms: Date.now() - started };
}

/** Sync now, or join the sync already running. */
export function syncRemote(): Promise<RemoteSync> {
  S.running ??= run().finally(() => {
    S.running = null;
  });
  return S.running;
}

/** Sync in a moment, once, however many changes ask: after a new index or a new line of history. */
export function syncSoon(delay = 4_000): void {
  if (DEMO || S.timer || !remoteConnected() || !remoteDatabase()) return;
  S.timer = setTimeout(() => {
    S.timer = null;
    void syncRemote();
  }, delay);
  S.timer.unref?.();
}

/** When the history is read: bring other machines' lines down, at most once a minute. */
export function pullSoon(): void {
  if (Date.now() - time(S.last?.at) >= PULL_EVERY_MS) syncSoon(0);
}

export interface RemoteStatus {
  configured: boolean; // remote.json (or INNERNET_REMOTE_DATABASE_URL) names a database
  connected: boolean;
  label: string; // "innernet-personal on Neon, us-east-1": never a secret
  syncing: boolean;
  last: RemoteSync | null;
}

/** Where the remote stands. Reads memory and this machine's database; never the network. */
export async function remoteStatus(): Promise<RemoteStatus> {
  const config = remoteDatabase();
  let last = S.last;
  if (!last) {
    const local = await getDb();
    const [row] = local ? await local.query<{ value: RemoteSync }>("SELECT value FROM kv WHERE key = 'remote.last'").catch(() => []) : [];
    last = row?.value ?? null;
  }
  return { configured: !!config, connected: !DEMO && remoteConnected() && !!config, label: remoteLabel(config), syncing: !!S.running, last };
}
