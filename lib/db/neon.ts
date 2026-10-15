import "server-only";

import { DEMO } from "../mode";
import type { RemoteDatabase } from "../storage";
import type { Db, DbKind, Row } from "./types";

// Neon serverless Postgres over HTTPS: every query is one request with nothing kept
// open, which suits short-lived server functions. Two databases come through here, and
// they never mix:
//
//   the demo's   DATABASE_URL, set by the Vercel Marketplace on the demo's project. Only
//                the demo opens it; local mode refuses, whatever variables are set.
//   yours        the remote database you connect on Sources, kept in step with this
//                machine's PGlite (lib/storage.ts, ~/.innernet/remote.json). Only local
//                mode opens it, and never when it is the demo's.

const TIMEOUT_MS = 15_000;

async function client(url: string, kind: DbKind, label: string): Promise<Db> {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  const signal = () => ({ fetchOptions: { signal: AbortSignal.timeout(TIMEOUT_MS) } });
  return {
    kind,
    label,
    async query<T extends Row = Row>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params, signal())) as T[];
    },
    async batch(statements, options) {
      const queries = statements.map((s) => sql.query(s.text, s.params ?? []));
      const opts = options?.readOnly ? { ...signal(), isolationLevel: "RepeatableRead" as const, readOnly: true } : signal();
      return (await sql.transaction(queries, opts)) as Row[][];
    },
    async close() {
      /* nothing is held open between queries */
    },
  };
}

/** The demo's database. */
export async function openNeon(): Promise<Db> {
  if (!DEMO) throw new Error("local mode never connects to the demo's database: this machine's data stays out of it");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return client(url, "neon", "Neon Postgres");
}

/** Your remote database, chosen on Sources. */
export async function openRemote(remote: RemoteDatabase, label: string): Promise<Db> {
  if (DEMO) throw new Error("the demo never opens a personal database");
  const demo = process.env.DATABASE_URL?.trim();
  if (demo && remote.url === demo) throw new Error("the remote database is the demo's, and this machine's data never goes there");
  return client(remote.url, "remote", label);
}
