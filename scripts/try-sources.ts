// Source selection, cross-source links and live search invalidation:
//   pnpm tsx --conditions=react-server scripts/try-sources.ts
// All file writes happen under an isolated temporary project; no running app is changed.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mergeIndexes } from "../lib/merge-indexes";
import type { Page, SiteIndex } from "../lib/types";

function page(slug: string, changes: Partial<Page> = {}): Page {
  return {
    slug, name: slug, title: slug, path: `/local/${slug}`, relPath: slug, root: "/local", depth: 0,
    kind: "project", realm: "project", isArticle: true, parent: null, partOf: null, children: [], hiddenChildren: [],
    files: [], fileCount: 0, totalFiles: 0, bytes: 0, totalBytes: 0, created: null, modified: null,
    languages: [], markers: [], frameworks: [], manifest: null, summary: null, readme: null,
    readmeFile: null, agentNotes: null, git: null, categories: ["Shared category"], related: [], words: 0,
    ...changes,
  };
}

function index(pages: Page[], remote = false): SiteIndex {
  return {
    meta: {
      generatedAt: "2026-10-03T00:00:00.000Z", roots: [{ label: remote ? "github.com/quirq-ai" : "/local", path: remote ? "https://github.com/quirq-ai" : "/local" }],
      maxDepth: 1, counts: { pages: pages.length, articles: pages.length, repos: 0, stubs: 0, categories: 1 }, durationMs: 10,
      ...(remote ? { demo: { org: "quirq-ai", repos: [] } } : {}),
    },
    pages,
    disambiguation: {},
  };
}

async function main() {
  const local = index([
    page("shared", { readme: "localunique discovery", children: ["child"], related: ["child"] }),
    page("child", { parent: "shared", partOf: "shared", depth: 1 }),
  ]);
  const remote = index([
    page("shared", { path: "https://github.com/quirq-ai/shared", root: "github.com/quirq-ai", readme: "remoteunique discovery", children: ["child"], related: ["child"] }),
    page("child", { path: "https://github.com/quirq-ai/shared/tree/main/child", root: "github.com/quirq-ai", parent: "shared", partOf: "shared", depth: 1 }),
    page("child_(other)", { name: "child", root: "github.com/quirq-ai", parent: "shared", partOf: "shared", depth: 1 }),
  ], true);
  remote.disambiguation.child = { primary: "child", slugs: ["child", "child_(other)"] };
  const before = JSON.stringify([local, remote]);
  const combined = mergeIndexes(local, remote);
  assert.equal(JSON.stringify([local, remote]), before, "merging must not mutate disk/DB source objects");
  assert.equal(combined.pages.length, 5);
  assert.equal(new Set(combined.pages.map((p) => p.slug)).size, 5);
  assert.equal(combined.meta.demo, undefined, "a remote source does not turn the local app into a demo");
  assert.equal(combined.meta.counts.categories, 1);
  assert.deepEqual(combined.meta.roots, [...local.meta.roots, ...remote.meta.roots]);
  assert.deepEqual(combined.pages.find((p) => p.slug === "shared"), local.pages[0], "local URLs and content are retained");
  assert.equal(combined.pages.find((p) => p.slug === "github:child")?.parent, "github:shared");
  assert.equal(combined.pages.find((p) => p.slug === "github:child")?.partOf, "github:shared");
  assert.deepEqual(combined.pages.find((p) => p.slug === "github:shared")?.children, ["github:child"]);
  assert.deepEqual(combined.pages.find((p) => p.slug === "github:shared")?.related, ["github:child"]);
  assert.deepEqual(combined.disambiguation["github:child"], { primary: "github:child", slugs: ["github:child", "github:child_(other)"] });
  assert.deepEqual(combined.disambiguation.shared, { primary: "shared", slugs: ["shared", "github:shared"] });
  assert.deepEqual(combined.disambiguation.child, { primary: "child", slugs: ["child", "github:child", "github:child_(other)"] });
  const remoteOnly = mergeIndexes(null, remote);
  assert.deepEqual(remoteOnly.pages.map((p) => p.slug), combined.pages.slice(local.pages.length).map((p) => p.slug), "GitHub URLs stay stable when Local is toggled");
  assert.deepEqual(mergeIndexes(local, null).pages, local.pages);
  assert.equal(mergeIndexes(null, null).pages.length, 0);
  // A custom local index may already use the remote prefix; it still keeps its URL.
  const unusual = mergeIndexes(index([page("github:shared")]), remote);
  assert.equal(new Set(unusual.pages.map((p) => p.slug.toLowerCase())).size, unusual.pages.length);
  const unusualRemote = unusual.pages.find((p) => p.path === "https://github.com/quirq-ai/shared")!;
  assert.equal(unusual.pages.find((p) => p.slug === "github:child")?.parent, unusualRemote.slug);

  const project = fs.mkdtempSync(path.join(os.tmpdir(), "innernet-sources-"));
  const previousRoot = process.env.INNERNET_PROJECT_ROOT;
  const previousDb = process.env.INNERNET_DB;
  process.env.INNERNET_PROJECT_ROOT = project;
  process.env.INNERNET_DB = "off";
  try {
    fs.mkdirSync(path.join(project, "data", "demo"), { recursive: true });
    const write = (name: string, value: unknown) => fs.writeFileSync(path.join(project, "data", name), JSON.stringify(value));
    write("index.json", local);
    write("demo/index.json", remote);
    const { getIndex, getLocalIndex, resolveSlug } = await import("../lib/data");
    const { search, suggest } = await import("../lib/search");
    const { remoteOutputFile } = await import("../lib/sources");
    const collection = { repositories: ["quirq-ai/shared"] };
    const snapshotFile = remoteOutputFile(collection)!;

    const original = getIndex();
    assert.equal(original.index.pages.length, 2, "Local is selected by default");
    assert.equal(search("remoteunique").total, 0);
    assert.equal(search("localunique").total, 1);
    assert.equal(getIndex().version, original.version, "unchanged source reads share one search version");

    write("sources.json", { local: false, remote: true, remoteConfig: collection });
    assert.equal(search("remoteunique").total, 0, "an unsynced collection shows no remote pages, and never the bundled demo");
    fs.writeFileSync(snapshotFile, JSON.stringify(remote));
    const remoteView = getIndex();
    assert.notEqual(remoteView.version, original.version);
    assert.equal(search("localunique").total, 0, "deselected pages leave the search engine");
    assert.equal(search("remoteunique").total, 1, "the collection's snapshot serves once synced");
    assert.equal(suggest("shared")[0]?.slug, "github:shared");
    assert.equal(getLocalIndex().index.pages.length, 2, "database storage still receives only the original local index");

    write("sources.json", { local: true, remote: true, remoteConfig: collection });
    const both = getIndex();
    assert.notEqual(both.version, remoteView.version);
    assert.equal(search("discovery").total, 2);
    assert.equal(both.byName.get("child")?.length, 3);
    assert.equal(both.categories.get("Shared category")?.length, 5);
    const resolved = resolveSlug("github:child_(disambiguation)");
    assert.equal(resolved.type, "disambiguation");
    if (resolved.type === "disambiguation") {
      assert.equal(resolved.primary?.slug, "github:child");
      assert.equal(resolved.pages.length, 2);
    }
    const globalList = resolveSlug("child_(disambiguation)");
    assert.equal(globalList.type, "disambiguation");
    if (globalList.type === "disambiguation") assert.equal(globalList.pages.length, 3);

    const refreshed = structuredClone(remote);
    refreshed.pages[0].readme = "freshremote discovery";
    fs.writeFileSync(snapshotFile, JSON.stringify(refreshed));
    const refreshedView = getIndex();
    assert.notEqual(refreshedView.version, both.version);
    assert.equal(search("remoteunique").total, 0);
    assert.equal(search("freshremote").total, 1, "a new sync replaces the snapshot without restart");

    fs.unlinkSync(snapshotFile);
    assert.notEqual(getIndex().version, refreshedView.version);
    assert.equal(search("remoteunique").total, 0, "removing the snapshot removes its pages; the bundled demo never stands in");
    assert.equal(search("freshremote").total, 0);

    write("sources.json", { local: true, remote: false });
    assert.equal(search("freshremote").total, 0);
    assert.equal(search("localunique").total, 1);
    assert.notEqual(getIndex().version, refreshedView.version);
    assert.equal(getLocalIndex().index.meta.demo, undefined);
    console.log("Source selection passed: local / remote / both, links, disambiguation, per-collection snapshots, search refresh and local storage isolation.");
  } finally {
    if (previousRoot === undefined) delete process.env.INNERNET_PROJECT_ROOT;
    else process.env.INNERNET_PROJECT_ROOT = previousRoot;
    if (previousDb === undefined) delete process.env.INNERNET_DB;
    else process.env.INNERNET_DB = previousDb;
    const resolved = fs.realpathSync(project);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("innernet-sources-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
