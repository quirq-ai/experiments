// Two machines and one remote database, all PGlite in a temporary folder, no network:
//   pnpm tsx --conditions=react-server scripts/try-remote-sync.ts
// Checks the sync both ways (lib/db/remote-sync.ts): the index and history going up, a
// new machine taking both down, lines crossing between machines, an index followed, a
// deletion honoured everywhere it can be, and the demo's database refused.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Page, SiteIndex } from "../lib/types";

function page(slug: string): Page {
  return {
    slug, name: slug, title: slug, path: `/fixture/${slug}`, relPath: slug, root: "/fixture", depth: 0,
    kind: "project", realm: "project", isArticle: true, parent: null, partOf: null, children: [], hiddenChildren: [],
    files: [], fileCount: 0, totalFiles: 0, bytes: 0, totalBytes: 0, created: null, modified: null,
    languages: [], markers: [], frameworks: [], manifest: null, summary: null, readme: null,
    readmeFile: null, agentNotes: null, git: null, categories: [], related: [], words: 0,
  };
}

function index(generatedAt: string, slug: string): SiteIndex {
  return {
    meta: { generatedAt, roots: [{ label: "/fixture", path: "/fixture" }], maxDepth: 1, counts: { pages: 1, articles: 1, repos: 0, stubs: 0, categories: 0 }, durationMs: 1 },
    pages: [page(slug)],
    disambiguation: {},
  };
}

const line = (n: number) => JSON.stringify({ at: `2026-10-03T10:00:0${n}.000Z`, app: "innernet", kind: "visit", url: `/wiki/p${n}`, title: `p${n}` });

function write(dir: string, session: string, lines: string[]) {
  fs.mkdirSync(path.join(dir, session), { recursive: true });
  fs.writeFileSync(path.join(dir, session, "innernet.jsonl"), lines.join("\n") + "\n");
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "innernet-remote-sync-"));
  const previous = { remote: process.env.INNERNET_REMOTE, history: process.env.INNERNET_HISTORY_DIR, home: process.env.INNERNET_HOME };
  // Deletions are remembered only while a remote is connected.
  process.env.INNERNET_REMOTE = "on";
  process.env.INNERNET_HISTORY_DIR = path.join(root, "unused-history");
  process.env.INNERNET_HOME = path.join(root, "home");
  const open: { close(): Promise<void> }[] = [];
  try {
    const { openPglite } = await import("../lib/db/pglite");
    const { bootstrap } = await import("../lib/db/schema");
    const { ingestHistory } = await import("../lib/db/ingest");
    const { storeIndex } = await import("../lib/db/index-store");
    const { syncBetween } = await import("../lib/db/remote-sync");
    const db = async (name: string) => {
      const opened = await openPglite(path.join(root, name), "try-remote-sync");
      assert.ok(opened.ok, `open ${name}`);
      if (!opened.ok) throw new Error("unreachable");
      await bootstrap(opened.db);
      open.push(opened.db);
      return opened.db;
    };
    const a = await db("a-db");
    const b = await db("b-db");
    const r = await db("remote-db");
    const remote = { ...r, kind: "remote" as const };
    const A = { indexFile: path.join(root, "a-index.json"), historyDir: path.join(root, "a-history") };
    const B = { indexFile: path.join(root, "b-index.json"), historyDir: path.join(root, "b-history") };
    const sA = "2026-10-03T10-00-00Z_machinea1";
    const sB = "2026-10-03T11-00-00Z_machineb1";
    const count = async (d: typeof a) => Number((await d.query<{ n: number }>("SELECT count(*)::int AS n FROM activity"))[0].n);

    // Machine A has its own index and three lines of history.
    write(A.historyDir, sA, [line(1), line(2), line(3)]);
    await ingestHistory(a, { dir: A.historyDir });
    await storeIndex(a, index("2026-10-03T09:00:00.000Z", "alpha"));
    fs.writeFileSync(A.indexFile, JSON.stringify(index("2026-10-03T09:00:00.000Z", "alpha")));

    // 1. A connects: its index and history go up; a second sync has nothing to do.
    let s = await syncBetween(a, remote, A);
    assert.deepEqual([s.ok, s.index, s.up, s.down, s.pages, s.lines], [true, "up", 3, 0, 1, 3]);
    s = await syncBetween(a, remote, A);
    assert.deepEqual([s.index, s.up, s.down], ["same", 0, 0], "a second sync sends nothing");

    // 2. B, a new machine with no index and no history, connects: both come down, the
    //    history as files first (the record), then into B's database.
    s = await syncBetween(b, remote, B);
    assert.deepEqual([s.index, s.down], ["down", 3]);
    const pulled = JSON.parse(fs.readFileSync(B.indexFile, "utf8")) as SiteIndex;
    assert.equal(pulled.meta.fromRemote, true, "a pulled index is marked as the remote's");
    assert.equal(pulled.pages[0].slug, "alpha");
    assert.equal(fs.readFileSync(path.join(B.historyDir, sA, "innernet.jsonl"), "utf8").trim().split("\n").length, 3, "A's session comes down as a folder");
    assert.equal(await count(b), 3, "and into B's database");
    await storeIndex(b, pulled); // what B's server does when it loads the pulled file

    // 3. B browses: its line goes up, and comes down on A.
    write(B.historyDir, sB, [line(4)]);
    await ingestHistory(b, { dir: B.historyDir });
    s = await syncBetween(b, remote, B);
    assert.deepEqual([s.index, s.up, s.down], ["same", 1, 0], "B never sends a pulled index back up");
    s = await syncBetween(a, remote, A);
    assert.equal(s.down, 1);
    assert.ok(fs.existsSync(path.join(A.historyDir, sB, "innernet.jsonl")), "B's session arrives on A as a folder");
    assert.equal(await count(a), 4);

    // 4. A re-indexes: the newer index goes up, and B, which follows the remote, takes it.
    await storeIndex(a, index("2026-10-03T12:00:00.000Z", "beta"));
    s = await syncBetween(a, remote, A);
    assert.equal(s.index, "up");
    s = await syncBetween(b, remote, B);
    assert.equal(s.index, "down");
    assert.equal((JSON.parse(fs.readFileSync(B.indexFile, "utf8")) as SiteIndex).pages[0].slug, "beta", "a following machine takes the newer index");
    // A machine indexing its own folders keeps its own index, even when older.
    await storeIndex(b, index("2026-10-03T08:00:00.000Z", "own"));
    s = await syncBetween(b, remote, B);
    assert.equal(s.index, "kept", "an older index of B's own stays, and is not sent up");

    // 5. A deletes B's session: it is deleted remotely and never comes back to A, even after
    //    B, which still holds it, sends it up again.
    fs.rmSync(path.join(A.historyDir, sB), { recursive: true });
    await ingestHistory(a, { dir: A.historyDir });
    assert.equal(await count(a), 3, "A's database forgets the deleted session");
    s = await syncBetween(a, remote, A);
    assert.deepEqual([s.removed, s.down], [1, 0], "deleted there too, and not brought back");
    assert.equal(s.lines, 3);
    s = await syncBetween(b, remote, B);
    assert.equal(s.up, 1, "B still has the line and sends it again");
    s = await syncBetween(a, remote, A);
    assert.equal(s.down, 0, "A keeps it deleted");
    assert.ok(!fs.existsSync(path.join(A.historyDir, sB)));

    // 6. Never the demo's database, never a remote as this machine's.
    await assert.rejects(syncBetween(a, { ...r, kind: "neon" as const }, A), /never the demo/);
    await assert.rejects(syncBetween(remote, a, A), /never the demo/);
    console.log("Remote sync passed: index and history up, a new machine taking both down, lines crossing machines, a followed index, an own index kept, deletions honoured, the demo refused.");
  } finally {
    for (const d of open) await d.close().catch(() => undefined);
    for (const [key, value] of [["INNERNET_REMOTE", previous.remote], ["INNERNET_HISTORY_DIR", previous.history], ["INNERNET_HOME", previous.home]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
