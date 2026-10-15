// Remote input as a collection of GitHub repositories, and snapshot isolation:
//   pnpm tsx --conditions=react-server scripts/try-remote-config.ts
// All files, history and database paths are confined to a temporary project.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeRemoteConfig, parseRepository, remoteActivityFields, remoteOwners } from "../lib/remote-config";
import { MAX_EVENT_BYTES } from "../components/activity/shared";
import type { Page, SiteIndex } from "../lib/types";

function checkNormalization() {
  const expected = { repositories: ["octocat/hello-world", "quirq-ai/alpha", "quirq-ai/innernet"] };
  assert.deepEqual(
    normalizeRemoteConfig({
      repositories: [" https://github.com/QUIRQ-AI/Innernet.git ", "quirq-ai/ALPHA", "https://github.com/quirq-ai/alpha/", "github.com/Octocat/Hello-World", "", "quirq-ai/innernet"],
    }),
    expected,
    "links, owner/name, case, slashes and duplicates normalize to a sorted, unique list across accounts",
  );
  assert.deepEqual(normalizeRemoteConfig(expected), expected, "canonical settings are idempotent");
  assert.deepEqual(remoteOwners(expected), ["octocat", "quirq-ai"]);
  assert.deepEqual(normalizeRemoteConfig({ repositories: [] }), { repositories: [] }, "an empty collection is valid; Remote then has nothing to sync");

  for (const entry of [
    "innernet", ".", "..", "quirq-ai/../innernet", "quirq-ai/inner/net", "folder\\innernet", "%2e%2e/x", "quirq-ai/innernet__dot__git",
    "-quirq/innernet", "quirq-/innernet", "qu--irq/innernet", "https://example.com/quirq-ai/innernet", "http://github.com/quirq-ai/innernet",
    "https://user:password@github.com/quirq-ai/innernet", "https://github.com/quirq-ai", "https://github.com/quirq-ai/innernet/tree/main",
    "https://github.com/quirq-ai/innernet?ref=main", "https://github.com/quirq-ai/innernet#readme", "https://github.com:444/quirq-ai/innernet",
    "https://github.com/quirq-ai/old/../innernet", "https://github.com/quirq-ai/old/%2e%2e/innernet", "https://github.com/quirq-ai/inner%6eet",
    "https://github.com.evil.example/quirq-ai/innernet", "https://github.com/quirq-ai\\innernet",
  ]) {
    assert.throws(() => parseRepository(entry), `reject repository input: ${entry}`);
    assert.throws(() => normalizeRemoteConfig({ repositories: [entry] }), `reject a collection holding: ${entry}`);
  }
  for (const malformed of [null, [], {}, { repositories: "quirq-ai/innernet" }, { repositories: [null] }, { repositories: [3] }]) {
    assert.throws(() => normalizeRemoteConfig(malformed), "reject malformed settings");
  }
  assert.throws(() => normalizeRemoteConfig({ repositories: Array.from({ length: 51 }, (_, i) => `quirq-ai/repo${i}`) }), "bound the collection");

  // The old shape keeps working: names inside an account become owner/name, and a whole
  // account, no longer a choice, leaves an empty list that remembers why.
  assert.deepEqual(normalizeRemoteConfig({ owner: " Quirq-AI ", repositories: ["Innernet", "https://github.com/quirq-ai/galileo"] }), {
    repositories: ["quirq-ai/galileo", "quirq-ai/innernet"],
  });
  assert.deepEqual(normalizeRemoteConfig({ owner: "https://github.com/quirq-ai/", repositories: [] }), { repositories: [], legacyAccount: "quirq-ai" });
  assert.throws(() => normalizeRemoteConfig({ owner: "../other", repositories: [] }), "a malformed saved account is refused");
}

function snapshot(owner: string, slug: string): SiteIndex {
  const root = `https://github.com/${owner}`;
  const page: Page = {
    slug, name: slug, title: slug, path: `${root}/${slug}`, relPath: slug, root, depth: 0,
    kind: "project", realm: "project", isArticle: true, parent: null, partOf: null, children: [], hiddenChildren: [],
    files: [], fileCount: 0, totalFiles: 0, bytes: 0, totalBytes: 0, created: null, modified: null,
    languages: [], markers: [], frameworks: [], manifest: null, summary: null, readme: `${slug} fixture repository`,
    readmeFile: null, agentNotes: null, git: null, categories: [], related: [], words: 3,
  };
  return {
    meta: {
      generatedAt: "2026-10-03T00:00:00.000Z", roots: [{ label: `github.com/${owner}`, path: root }],
      maxDepth: 1, counts: { pages: 1, articles: 1, repos: 1, stubs: 0, categories: 0 }, durationMs: 1,
      demo: { org: owner, repos: [] },
    },
    pages: [page], disambiguation: {},
  };
}

async function main() {
  checkNormalization();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "innernet-remote-config-"));
  const overrides: Record<string, string> = {
    INNERNET_PROJECT_ROOT: project,
    INNERNET_DB: "off",
    INNERNET_DB_DIR: path.join(project, "db"),
    INNERNET_HISTORY_DIR: path.join(project, "history"),
    INNERNET_HOME: path.join(project, "home"),
    INNERNET_DEMO: "0", INNERNET_DEMO_BUILD: "0", VERCEL: "0",
  };
  const previous = new Map(Object.keys(overrides).map((key) => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  try {
    fs.mkdirSync(path.join(project, "data", "demo"), { recursive: true });
    fs.writeFileSync(path.join(project, "innernet.config.json"), JSON.stringify({ roots: [project], maxDepth: 1 }));
    const sources = await import("../lib/sources");
    const { getIndex } = await import("../lib/data");
    const { sourceInfo } = await import("../lib/source-storage");
    const { appendEvent } = await import("../lib/activity");
    const session = "2026-10-03T00-00-00Z_remotecheck";
    const onlyRemote = { local: false, remote: true };
    const custom = normalizeRemoteConfig({ repositories: ["https://github.com/Octocat/Hello-World"] });
    const mixed = normalizeRemoteConfig({ repositories: ["quirq-ai/innernet", "octocat/hello-world"] });
    const writeSnapshot = (file: string | null, owner: string, slug: string) => fs.writeFileSync(file!, JSON.stringify(snapshot(owner, slug)));

    assert.equal(sources.SOURCE_SETTINGS_FILE, path.join(project, "data", "sources.json"));
    assert.deepEqual(sources.readSourceSelection(), { local: true, remote: false });
    assert.deepEqual(sources.readRemoteConfig(), { repositories: [] }, "a new installation starts with no repositories");
    fs.writeFileSync(sources.SOURCE_SETTINGS_FILE, JSON.stringify(onlyRemote));
    assert.deepEqual(sources.readSourceSelection(), onlyRemote);
    assert.deepEqual(sources.readRemoteConfig(), { repositories: [] }, "legacy boolean-only settings remain supported");
    assert.equal(sources.remoteIndexFile(), null, "an empty collection has no snapshot, and never the bundled demo");
    assert.deepEqual(getIndex().index.pages, [], "and shows no remote pages");

    // A saved whole account (the old default) is remembered, not fetched.
    fs.writeFileSync(sources.SOURCE_SETTINGS_FILE, JSON.stringify({ ...onlyRemote, remoteConfig: { owner: "quirq-ai", repositories: [] } }));
    assert.deepEqual(sources.readRemoteConfig(), { repositories: [], legacyAccount: "quirq-ai" });
    assert.equal(sourceInfo(session).remote.legacyAccount, "quirq-ai", "Sources says why the list is empty");

    const canonical = normalizeRemoteConfig({ repositories: ["Quirq-AI/ZETA", "quirq-ai/alpha", "QUIRQ-AI/alpha"] });
    const same = normalizeRemoteConfig({ repositories: ["https://github.com/quirq-ai/alpha.git", "quirq-ai/zeta"] });
    assert.equal(sources.remoteOutputFile(canonical), sources.remoteOutputFile(same), "equivalent collections reuse their snapshot");
    const files = [canonical, custom, mixed].map((config) => sources.remoteOutputFile(config));
    assert.equal(new Set(files).size, files.length, "different collections have separate snapshots");
    for (const file of files) assert.equal(path.dirname(file!), path.join(project, "data"));

    sources.writeSourceSelection(onlyRemote, custom);
    assert.deepEqual(JSON.parse(fs.readFileSync(sources.SOURCE_SETTINGS_FILE, "utf8")), { ...onlyRemote, remoteConfig: custom });
    assert.deepEqual(sources.readSourceSelection(), onlyRemote, "adding repositories does not change source booleans");
    assert.deepEqual(sources.readRemoteConfig(), custom);
    let details = sourceInfo(session);
    assert.deepEqual(details.remote.repositories, ["octocat/hello-world"]);
    assert.equal(details.remote.legacyAccount, null, "saving clears the old account notice");
    assert.equal(details.remote.needsSync, true);
    assert.equal(details.remote.generatedAt, null);
    assert.equal(details.generated.find((item) => item.id === "remote-index")?.exists, false);
    const unsynced = getIndex();
    assert.equal(unsynced.missing, true);
    assert.deepEqual(unsynced.index.pages, [], "an unsynced collection shows no stale pages");

    writeSnapshot(sources.remoteOutputFile(custom), "octocat", "customfixture");
    const synced = getIndex();
    assert.notEqual(synced.version, unsynced.version);
    assert.deepEqual(synced.index.pages.map((page) => page.slug), ["github:customfixture"], "the collection's snapshot loads without a restart");
    details = sourceInfo(session);
    assert.equal(details.remote.needsSync, false);
    assert.equal(details.remote.generatedAt, "2026-10-03T00:00:00.000Z");
    const row = details.generated.find((item) => item.id === "remote-index");
    assert.equal(row?.exists, true);
    assert.ok(row && row.path.startsWith("data/github-") && !row.path.includes(project), "generated paths are shown relative to the app");

    sources.writeSourceSelection({ local: true, remote: true });
    assert.deepEqual(sources.readRemoteConfig(), custom, "changing only booleans keeps the saved repositories");
    sources.writeSourceSelection(onlyRemote, mixed);
    assert.equal(sources.remoteIndexFile(), sources.remoteOutputFile(mixed));
    assert.deepEqual(getIndex().index.pages, [], "a changed collection never shows another collection's snapshot");
    writeSnapshot(sources.remoteOutputFile(mixed), "github.com", "mixedfixture");
    assert.deepEqual(getIndex().index.pages.map((page) => page.slug), ["github:mixedfixture"]);
    sources.writeSourceSelection(onlyRemote, custom);
    assert.deepEqual(getIndex().index.pages.map((page) => page.slug), ["github:customfixture"], "returning to a saved collection reuses its own snapshot");
    fs.unlinkSync(sources.remoteOutputFile(custom)!);
    assert.deepEqual(getIndex().index.pages, [], "a removed snapshot leaves no cached pages behind");

    for (const invalid of [
      JSON.stringify({ ...onlyRemote, remoteConfig: { repositories: ["../other"] } }),
      JSON.stringify({ ...onlyRemote, remoteConfig: { owner: "../other", repositories: [] } }),
      JSON.stringify({ ...onlyRemote, remoteConfig: null }),
      JSON.stringify({ ...onlyRemote, remoteConfig: [] }),
      '{"local":false,"remote":true,"remoteConfig":',
    ]) {
      fs.writeFileSync(sources.SOURCE_SETTINGS_FILE, invalid);
      assert.throws(() => sources.readRemoteConfig(), "malformed saved settings are refused, never replaced by a default");
      assert.deepEqual(getIndex().index.pages, [], "bad source settings remove remote pages until repaired");
      const broken = sourceInfo(session);
      assert.ok(broken.remote.error, "Sources explains malformed saved settings");
      assert.deepEqual(broken.remote.repositories, []);
      sources.writeSourceSelection(onlyRemote, mixed);
      assert.deepEqual(sources.readRemoteConfig(), mixed, "an explicit valid save repairs malformed settings");
      assert.equal(sourceInfo(session).remote.error, undefined);
      assert.deepEqual(getIndex().index.pages.map((page) => page.slug), ["github:mixedfixture"]);
    }

    const maximum = normalizeRemoteConfig({
      repositories: Array.from({ length: 50 }, (_, index) => `${"a".repeat(39)}/repo${String(index).padStart(2, "0")}${"x".repeat(94)}`),
    });
    const audit = remoteActivityFields(maximum);
    assert.equal(audit.repositoryCount, 50, "activity records the full repository count");
    assert.deepEqual(audit.repositories, maximum.repositories.slice(0, 5), "activity bounds the repository sample");
    const event = {
      at: "2026-10-03T00:00:00.000Z", app: "innernet", kind: "sync", status: "completed", title: "Sources synced",
      command: "pnpm index + pnpm index:demo", local: true, remote: true, pages: 9999, durationMs: 300000, ...audit,
    };
    assert.ok(Buffer.byteLength(JSON.stringify(event) + "\n") <= MAX_EVENT_BYTES, "the largest valid collection fits an activity event");
    assert.deepEqual(appendEvent(session, "innernet", event), { ok: true }, "activity accepts the largest collection's summary");
    const recorded = JSON.parse(fs.readFileSync(path.join(project, "history", session, "innernet.jsonl"), "utf8"));
    assert.equal(recorded.repositoryCount, 50);
    assert.equal(recorded.repositories.length, 5);
    console.log("Remote configuration passed: links across accounts, validation, legacy settings, persistence, isolated snapshots, live reload, sync status, invalid-file repair and bounded activity.");
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    const resolved = fs.realpathSync(project);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("innernet-remote-config-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
