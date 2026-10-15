import "server-only";

import { jsonParam } from "./schema";
import type { Db } from "./types";

// History this machine has forgotten (a session folder or a line you deleted), remembered
// while a remote database is connected, so the sync deletes it there too and never brings
// it back down. Kept in this machine's database, under kv remote.forgotten: the newest
// 20,000 uids, which is far more lines than anyone deletes between two syncs.

const KEY = "remote.forgotten";
const MAX = 20_000;

/** The uids forgotten here, as a set. */
export async function forgottenUids(db: Db): Promise<Set<string>> {
  const [row] = await db.query<{ value: unknown }>("SELECT value FROM kv WHERE key = $1", [KEY]);
  return new Set(Array.isArray(row?.value) ? (row.value as unknown[]).filter((u): u is string => typeof u === "string") : []);
}

/** Add uids to the forgotten, newest last, keeping the newest MAX. */
export async function rememberForgotten(db: Db, uids: string[]): Promise<void> {
  if (!uids.length) return;
  const merged = [...new Set([...(await forgottenUids(db)), ...uids])].slice(-MAX);
  await db.query(
    "INSERT INTO kv (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [KEY, jsonParam(merged)],
  );
}
