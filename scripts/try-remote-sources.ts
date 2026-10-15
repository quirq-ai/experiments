// No network, clones or index writes. Run: node --import tsx scripts/try-remote-sources.ts
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fetchSourceRepos, githubSelection, stillPublic } from "./build-demo-index";

const publicRepo = (name = "Hello-World", overrides: Record<string, unknown> = {}) => ({
  name,
  owner: { login: "octocat" },
  private: false,
  visibility: "public",
  archived: false,
  disabled: false,
  fork: false,
  size: 1,
  default_branch: "main",
  description: null,
  ...overrides,
});

async function main() {
  // The demo, and the older forms: one account, whole or by bare names.
  assert.deepEqual(githubSelection({}), [{ owner: "quirq-ai", repositories: "all" }]);
  assert.deepEqual(githubSelection({ INNERNET_GITHUB_REPOSITORIES: "[]" }), [{ owner: "quirq-ai", repositories: "all" }]);
  assert.deepEqual(githubSelection({ INNERNET_GITHUB_OWNER: " OctoCat " }), [{ owner: "octocat", repositories: "all" }]);
  assert.deepEqual(githubSelection({ INNERNET_GITHUB_OWNER: "octocat", INNERNET_GITHUB_REPOSITORIES: "[]" }), [{ owner: "octocat", repositories: "all" }]);
  assert.deepEqual(githubSelection({ INNERNET_GITHUB_OWNER: " OctoCat ", INNERNET_GITHUB_REPOSITORIES: '["Hello-World", "hello-world", ".github"]' }), [
    { owner: "octocat", repositories: [".github", "hello-world"] },
  ]);
  assert.deepEqual(githubSelection({ INNERNET_GITHUB_REPOSITORIES: '["innernet"]' }), [{ owner: "quirq-ai", repositories: ["innernet"] }]);

  // Listed repositories from any accounts, as Sources passes them: grouped by account.
  assert.deepEqual(githubSelection({ INNERNET_GITHUB_REPOSITORIES: '["quirq-ai/innernet", " OctoCat/Hello-World ", "octocat/hello-world", "octocat/.github", "quirq-ai/galileo"]' }), [
    { owner: "octocat", repositories: [".github", "hello-world"] },
    { owner: "quirq-ai", repositories: ["galileo", "innernet"] },
  ]);
  assert.deepEqual(githubSelection({ INNERNET_GITHUB_OWNER: "octocat", INNERNET_GITHUB_REPOSITORIES: '["octocat/hello-world"]' }), [
    { owner: "octocat", repositories: ["hello-world"] },
  ]);
  const fifty = Array.from({ length: 50 }, (_, i) => `octocat/repo-${i}`);
  assert.equal(githubSelection({ INNERNET_GITHUB_REPOSITORIES: JSON.stringify([...fifty, "OCTOCAT/repo-0"]) })[0].repositories.length, 50);

  for (const owner of ["", " ", "../octocat", "https://github.com/octocat", "-octocat", "octocat-", "a--b", "octo_cat", "x".repeat(40)]) {
    assert.throws(() => githubSelection({ INNERNET_GITHUB_OWNER: owner }), /INNERNET_GITHUB_OWNER must be a GitHub/, owner);
  }
  for (const repositories of [
    "oops", '"innernet"', "{}", "[null]", "[1]", '[""]', '["."]', '[".."]', '["__dot__github"]', '["hello world"]', '["octocat\\\\hello-world"]',
    '["octocat/hello-world", "innernet"]', // owner/name and bare names together
    '["../innernet"]', '["octocat/"]', '["/hello-world"]', '["octocat/hello/world"]', '["octocat/."]', '["octocat/.."]', '["octocat/__dot__github"]',
    '["-octocat/hello-world"]', '["a--b/hello-world"]', '["octo_cat/hello-world"]',
    '["https://github.com/octocat/hello-world"]', '["github.com/octocat/hello-world"]',
    JSON.stringify([...fifty, "octocat/repo-50"]), // more than 50
  ]) {
    assert.throws(() => githubSelection({ INNERNET_GITHUB_REPOSITORIES: repositories }), /INNERNET_GITHUB_REPOSITORIES/, repositories);
  }
  assert.throws(
    () => githubSelection({ INNERNET_GITHUB_OWNER: "octocat", INNERNET_GITHUB_REPOSITORIES: '["octocat/hello-world", "quirq-ai/innernet"]' }),
    /outside INNERNET_GITHUB_OWNER/,
  );

  const originalFetch = globalThis.fetch;
  let requests: string[] = [];
  let respond: (url: string) => Response = () => { throw new Error("no mocked response"); };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.ok(url.startsWith("https://api.github.com/"));
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    requests.push(url);
    return respond(url);
  };
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
  const whole = (owner: string) => ({ owner, repositories: "all" as const });

  try {
    // A whole account: an organization, else a user, page by page, and only what is public.
    respond = () => json([publicRepo(), publicRepo("private", { private: true, visibility: "private" })]);
    assert.equal((await fetchSourceRepos(whole("octocat"))).length, 1);
    assert.deepEqual(requests, ["https://api.github.com/orgs/octocat/repos?type=public&per_page=100&page=1"]);

    requests = [];
    respond = (url) => url.includes("/orgs/") ? json({}, 404) : json([publicRepo()]);
    assert.equal((await fetchSourceRepos(whole("octocat")))[0].name, "Hello-World");
    assert.deepEqual(requests, [
      "https://api.github.com/orgs/octocat/repos?type=public&per_page=100&page=1",
      "https://api.github.com/users/octocat/repos?type=owner&per_page=100&page=1",
    ]);

    requests = [];
    respond = (url) => json(url.endsWith("page=1") ? Array.from({ length: 100 }, (_, i) => publicRepo(`repo-${i}`)) : [publicRepo()]);
    assert.equal((await fetchSourceRepos(whole("octocat"))).length, 101);
    assert.equal(requests.length, 2);

    // Named repositories: one call each, and every one must be indexable.
    requests = [];
    respond = () => json(publicRepo());
    assert.deepEqual((await fetchSourceRepos({ owner: "octocat", repositories: ["hello-world"] })).map((r) => r.name), ["Hello-World"]);
    assert.deepEqual(requests, ["https://api.github.com/repos/octocat/hello-world"]);

    for (const [overrides, message] of [
      [{ private: true, visibility: "private" }, /not public/],
      [{ archived: true }, /archived/],
      [{ disabled: true }, /disabled/],
      [{ size: 0 }, /empty/],
      [{ default_branch: null }, /empty/],
      [{ owner: { login: "other-owner" } }, /outside the requested source/],
      [{ name: "renamed-repository" }, /outside the requested source/],
    ] as const) {
      respond = () => json(publicRepo("Hello-World", overrides));
      await assert.rejects(fetchSourceRepos({ owner: "octocat", repositories: ["hello-world"] }), message);
    }
    respond = () => json({}, 404);
    await assert.rejects(fetchSourceRepos({ owner: "octocat", repositories: ["missing"] }), /was not found or is not public/);

    // Nothing unvalidated ever becomes part of a URL.
    requests = [];
    await assert.rejects(fetchSourceRepos(whole("../octocat")), /refusing/);
    await assert.rejects(fetchSourceRepos({ owner: "octocat", repositories: ["../hello-world"] }), /refusing/);
    assert.equal(requests.length, 0);

    // A rate limit says so, and is never mistaken for a missing organization.
    for (const status of [403, 429]) {
      requests = [];
      respond = () => json({}, status);
      await assert.rejects(fetchSourceRepos(whole("octocat")), /anonymous calls are limited to 60 an hour/);
      assert.equal(requests.length, 1, "a rate limit must not trigger user-account fallback");
      await assert.rejects(fetchSourceRepos({ owner: "octocat", repositories: ["hello-world"] }), new RegExp(`answered ${status} .*anonymous calls are limited`));
    }

    // Two accounts: one API call per repository in all, the check before the write
    // included, since that one asks git.
    requests = [];
    respond = (url) =>
      url === "https://api.github.com/repos/octocat/hello-world" ? json(publicRepo())
      : url === "https://api.github.com/repos/quirq-ai/innernet" ? json(publicRepo("innernet", { owner: { login: "quirq-ai" } }))
      : json({}, 404);
    const accounts = githubSelection({ INNERNET_GITHUB_REPOSITORIES: '["quirq-ai/innernet","octocat/hello-world"]' });
    const fetched = new Map<string, string[]>();
    for (const account of accounts) fetched.set(account.owner, (await fetchSourceRepos(account)).map((r) => r.name));
    assert.deepEqual([...fetched], [["octocat", ["Hello-World"]], ["quirq-ai", ["innernet"]]]);
    const asked: string[] = [];
    for (const account of accounts) {
      const repos = fetched.get(account.owner)!.map((name) => ({ name, branch: "main" }));
      const problems = await stillPublic(account, repos, (owner, name, branch) => {
        asked.push(`${owner}/${name}@${branch}`);
        return true;
      });
      assert.deepEqual(problems, []);
    }
    assert.deepEqual(asked, ["octocat/Hello-World@main", "quirq-ai/innernet@main"]);
    assert.deepEqual(requests, ["https://api.github.com/repos/octocat/hello-world", "https://api.github.com/repos/quirq-ai/innernet"]);

    // A listed repository git can no longer read anonymously does not ship.
    assert.deepEqual(await stillPublic(accounts[1], [{ name: "innernet", branch: "main" }], () => false), [
      "quirq-ai/innernet is no longer a public repository: git could not read its main branch anonymously",
    ]);
    assert.equal(requests.length, 2);

    // A whole account is listed once more instead, and a repository made private
    // meanwhile does not ship.
    requests = [];
    let lists = 0;
    respond = () => json([publicRepo("Hello-World", ++lists === 1 ? {} : { private: true, visibility: "private" }), publicRepo("Spoon-Knife")]);
    const before = (await fetchSourceRepos(whole("octocat"))).map((r) => ({ name: r.name, branch: "main" }));
    assert.deepEqual(await stillPublic(whole("octocat"), before, () => assert.fail("a whole account is not asked of git")), [
      "octocat/Hello-World is no longer a public repository",
    ]);
    assert.equal(requests.length, 2);
    console.log(
      "Remote sources passed: demo default, older owner forms, owner/name lists across accounts, validation, " +
        "organizations, users, pagination, rate limits, anonymous requests, one API call per listed repository and the public recheck.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Exercise the actual CLI entry point without touching a cache or the network.
  const projectDir = path.resolve(__dirname, "..");
  const testCache = ".remote-source-test-cache";
  const cli = (env: Record<string, string>, fetchSource: string) => {
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      INNERNET_REMOTE_CACHE: testCache,
      INNERNET_REMOTE_OUT: path.join(os.tmpdir(), `innernet-remote-source-test-${process.pid}.json`),
    };
    delete childEnv.INNERNET_GITHUB_OWNER;
    delete childEnv.INNERNET_GITHUB_REPOSITORIES;
    const preload = "data:text/javascript," + encodeURIComponent(fetchSource);
    return spawnSync(process.execPath, ["--import", "tsx", "--import", preload, "scripts/build-demo-index.ts"], {
      cwd: projectDir,
      env: { ...childEnv, ...env },
      encoding: "utf8",
      windowsHide: true,
    });
  };

  let run = cli({ INNERNET_GITHUB_OWNER: "octocat", INNERNET_GITHUB_REPOSITORIES: "[]" }, "globalThis.fetch = async () => new Response('[]', { status: 200 });");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /no public, non-empty repositories found for octocat/);

  // Two accounts reach the API one repository at a time, and the first refusal ends the run.
  run = cli(
    { INNERNET_GITHUB_REPOSITORIES: '["quirq-ai/innernet","octocat/hello-world"]' },
    "globalThis.fetch = async (url) => { process.stderr.write('fetch ' + url + '\\n'); return new Response('{}', { status: 404 }); };",
  );
  assert.equal(run.status, 1);
  assert.deepEqual(run.stderr.match(/^fetch .*$/gm), ["fetch https://api.github.com/repos/octocat/hello-world"]);
  assert.match(run.stderr, /GitHub repository octocat\/hello-world was not found or is not public/);

  // A selection that does not validate fails before any request.
  run = cli(
    { INNERNET_GITHUB_REPOSITORIES: '["octocat/hello-world","innernet"]' },
    "globalThis.fetch = async () => { process.stderr.write('unexpected request\\n'); return new Response('[]', { status: 200 }); };",
  );
  assert.equal(run.status, 1);
  assert.match(run.stderr, /not both/);
  assert.doesNotMatch(run.stderr, /unexpected request/);

  // The repositories are all checked before the cache is touched.
  assert.equal(fs.existsSync(path.join(projectDir, testCache)), false);
  console.log("Remote CLI entry point passed with isolated GitHub responses: one account, two accounts and an invalid list.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
