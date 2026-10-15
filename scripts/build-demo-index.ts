// Build a GitHub index: public repositories as one Innerpedia, one root per account.
//   pnpm index:demo        # all of github.com/quirq-ai: clones into .demo-cache/, writes data/demo/index.json
//   INNERNET_DEMO_MAX_DEPTH=4 pnpm index:demo   # fewer folder levels (default 6)
//   INNERNET_REMOTE_CACHE=.github-cache INNERNET_REMOTE_OUT=data/github.json \
//     INNERNET_GITHUB_REPOSITORIES='["octocat/hello-world","quirq-ai/innernet"]' pnpm index:demo
//     # local Sources sync: listed repositories (owner/name, at most 50) from any accounts;
//     # keeps the committed demo index and its cache separate
//   INNERNET_GITHUB_OWNER=octocat INNERNET_GITHUB_REPOSITORIES='["Hello-World"]' pnpm index:demo
//     # the older form, still read: names inside one account; with no names, or no list,
//     # every public repository of the account
//
// data/demo/index.json is committed, and it is all the demo (Vercel) ever serves, so this
// script keeps it to what any anonymous visitor of GitHub can already see:
//   - The repository list comes from the public GitHub REST API, unauthenticated: no gh,
//     no token. Only repositories it reports as public (private: false and visibility
//     "public") are cloned, and that is asserted again right before each clone.
//   - git runs without global or system config (GIT_CONFIG_GLOBAL=/dev/null,
//     GIT_CONFIG_NOSYSTEM=1), never finds this project's own repository around the cache
//     (GIT_CEILING_DIRECTORIES), and has no credential helper, so no stored login, token
//     or URL rewrite can reach anything an anonymous visitor could not.
//   - Clones live in .demo-cache/<account>/ (gitignored). Anything there that is not
//     selected is deleted before the crawl, accounts included, so a repository made
//     private drops out.
//   - The crawl is the ordinary one (scripts/build-index.ts, through its env overrides),
//     logos included. Afterwards every page path becomes its GitHub URL, file dates become
//     git dates, and the run fails if any string in the output, or any SVG logo once
//     decoded, still names this machine.
//   - Each account's root wears its public GitHub avatar, fetched here once, anonymously,
//     and embedded, so the demo itself never asks GitHub for anything.
//   - Right before the write, every repository is confirmed public once more: a whole
//     account by its list again, a listed repository by an anonymous `git ls-remote`.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DEMO_ORG } from "../lib/mode";
import { normalizeIndex } from "../lib/normalize";
import { cleanLine, markdownToText, redactSecrets } from "../lib/text";
import type { IndexMeta, Page, SiteIndex } from "../lib/types";

const started = Date.now();
const projectDir = path.resolve(__dirname, "..");
const cacheRoot = path.resolve(projectDir, process.env.INNERNET_REMOTE_CACHE || ".demo-cache");
const crawlFile = path.join(cacheRoot, "crawl.json");
const outFile = path.resolve(projectDir, process.env.INNERNET_REMOTE_OUT || path.join("data", "demo", "index.json"));
/** Commits fetched per repository. Dates and counts are read within this history. */
const HISTORY = 300;
/** Folder levels below an account that get pages (repositories are level 1). */
const MAX_DEPTH = Number(process.env.INNERNET_DEMO_MAX_DEPTH ?? 6);
/** The crawler skips dot folders, so ".github" is cloned under this stand-in and renamed back. */
const DOT = "__dot__";
const README_MAX = 14_000; // the crawler's README cap
/** Each listed repository costs one anonymous API call, of the 60 GitHub allows an hour. */
const MAX_REPOSITORIES = 50;

const accountUrl = (owner: string) => `https://github.com/${owner}`;
const rootLabel = (owner: string) => `github.com/${owner}`;
const ownerDir = (owner: string) => path.join(cacheRoot, owner);

/** One account's share of a selection: the repositories named, or every public one. */
export interface GithubAccount {
  owner: string;
  repositories: string[] | "all";
}

const LIST_ERROR = "INNERNET_GITHUB_REPOSITORIES must be a JSON array of owner/name strings";

/** Validate before a source can become part of an API URL or cache path. Entries with a
 * slash name their own accounts, any number of them. Bare names are the older form: they
 * belong to INNERNET_GITHUB_OWNER, and no names at all mean every public repository of
 * that account, or of the demo's when no account is set either. Accounts come back in
 * order, each once, their repositories lowercased and sorted. */
export function githubSelection(env: Record<string, string | undefined>): GithubAccount[] {
  const owner = env.INNERNET_GITHUB_OWNER?.trim().toLowerCase();
  if (owner !== undefined && !validOwner(owner)) throw new Error("INNERNET_GITHUB_OWNER must be a GitHub username or organization name");
  let list: unknown;
  try {
    list = JSON.parse(env.INNERNET_GITHUB_REPOSITORIES ?? "[]");
  } catch {
    throw new Error(LIST_ERROR);
  }
  if (!Array.isArray(list) || list.some((entry) => typeof entry !== "string")) throw new Error(LIST_ERROR);
  const entries = (list as string[]).map((entry) => entry.trim());
  const qualified = entries.filter((entry) => entry.includes("/")).length;
  if (qualified && qualified < entries.length) {
    throw new Error("INNERNET_GITHUB_REPOSITORIES must hold owner/name entries or bare names of INNERNET_GITHUB_OWNER, not both");
  }
  const repositories = entries.map((entry) => {
    const [login, name, ...rest] = qualified ? entry.split("/") : [owner ?? DEMO_ORG, entry];
    if (rest.length || !validOwner(login.toLowerCase()) || !validRepoName(name)) {
      throw new Error("INNERNET_GITHUB_REPOSITORIES must contain owner/name entries or repository names, without URLs or paths");
    }
    if (owner !== undefined && login.toLowerCase() !== owner) throw new Error("INNERNET_GITHUB_REPOSITORIES names a repository outside INNERNET_GITHUB_OWNER");
    return `${login.toLowerCase()}/${name.toLowerCase()}`;
  });
  const unique = [...new Set(repositories)].sort();
  if (unique.length > MAX_REPOSITORIES) throw new Error(`INNERNET_GITHUB_REPOSITORIES may list at most ${MAX_REPOSITORIES} repositories`);
  if (!unique.length) return [{ owner: owner ?? DEMO_ORG, repositories: "all" }];
  const byOwner = new Map<string, string[]>();
  for (const entry of unique) {
    const [login, name] = entry.split("/");
    byOwner.set(login, [...(byOwner.get(login) ?? []), name]);
  }
  return [...byOwner].map(([login, names]) => ({ owner: login, repositories: names }));
}

function validOwner(owner: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(owner) && !owner.includes("--");
}

function validRepoName(name: string): boolean {
  return /^[A-Za-z0-9._-]{1,100}$/.test(name) && name !== "." && name !== ".." && !name.includes("__dot__");
}

// A remote cache is disposable, so it must be a dedicated child of this project.
// Resolve and inspect every existing ancestor before deleting or running destructive
// git commands. In particular, an old cache must never redirect them via a junction.
function childPath(root: string, target: string): string {
  const resolved = path.resolve(target);
  const rel = path.relative(root, resolved);
  if (!rel || rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`refusing cache path outside ${root}: ${resolved}`);
  }
  return resolved;
}

function noLinkedAncestors(root: string, target: string, includeTarget = true): void {
  const rel = path.relative(root, childPath(root, target));
  const parts = rel.split(path.sep);
  if (!includeTarget) parts.pop();
  let current = root;
  for (const part of ["", ...parts]) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (stat?.isSymbolicLink()) throw new Error(`refusing linked cache path: ${current}`);
    if (stat && !stat.isDirectory() && current !== target) throw new Error(`cache parent is not a directory: ${current}`);
  }
}

function cachePath(target: string, includeTarget = true): string {
  const resolved = childPath(cacheRoot, target);
  noLinkedAncestors(projectDir, cacheRoot);
  noLinkedAncestors(cacheRoot, resolved, includeTarget);
  return resolved;
}

/** Delete only inside this cache. Links are unlinked, never followed, including
 * Windows junctions and links anywhere below a repository being discarded. */
function removeCacheEntry(target: string): void {
  const resolved = cachePath(target, false);
  const stat = fs.lstatSync(resolved, { throwIfNoEntry: false });
  if (!stat) return;
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fs.unlinkSync(resolved);
    return;
  }
  for (const name of fs.readdirSync(resolved)) removeCacheEntry(path.join(resolved, name));
  fs.rmdirSync(resolved);
}

/** Git's own metadata must also stay in the cache before fetch/reset/clean can run. */
function unlinkedTree(dir: string): boolean {
  const stat = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!stat || stat.isSymbolicLink()) return false;
  return !stat.isDirectory() || fs.readdirSync(dir).every((name) => unlinkedTree(path.join(dir, name)));
}

/** An account folder as this script leaves it: clones only, or nothing at all. Anything
 * else under an account-shaped name stays, should the cache setting ever point at a
 * folder that is no cache. Links count as neither, and are never followed. */
function holdsOnlyClones(dir: string): boolean {
  const isDir = (p: string) => fs.lstatSync(p, { throwIfNoEntry: false })?.isDirectory() === true;
  return isDir(dir) && fs.readdirSync(dir).every((name) => isDir(path.join(dir, name)) && isDir(path.join(dir, name, ".git")));
}

// ---------------------------------------------------------------- GitHub, anonymously

interface GhRepo {
  name: string;
  owner: { login: string };
  private: boolean;
  visibility?: string;
  archived: boolean;
  disabled?: boolean;
  fork: boolean;
  size: number;
  default_branch?: string | null;
  description: string | null;
}

/** Deliberately no Authorization header: an anonymous caller can only ever be shown
 * public repositories. Network errors are retried; HTTP errors are not. */
async function anonymousGet(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, {
        headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "innernet-demo-index" },
      });
    } catch (err) {
      if (attempt >= 4) throw new Error(`could not reach ${url}: ${err instanceof Error ? ((err.cause as Error | undefined)?.message ?? err.message) : err}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

function apiFailure(res: Response, url: string): Error {
  const hint = res.status === 403 || res.status === 429 ? " (anonymous calls are limited to 60 an hour; try again later)" : "";
  return new Error(`GitHub API answered ${res.status} for ${url}${hint}`);
}

function assertRepoIdentity(repo: GhRepo, owner: string, name?: string): void {
  if (!repo || !validRepoName(repo.name ?? "") || repo.owner?.login?.toLowerCase() !== owner
    || (name !== undefined && repo.name.toLowerCase() !== name.toLowerCase())) {
    throw new Error(`GitHub returned a repository outside the requested source ${owner}${name ? `/${name}` : ""}`);
  }
}

function unavailableReason(repo: GhRepo): string | null {
  return repo.private !== false || repo.visibility !== "public" ? "not public"
    : repo.archived ? "archived"
    : repo.disabled ? "disabled"
    : !(repo.size > 0) || !repo.default_branch ? "empty"
    : null;
}

/** One account's repositories. Organizations and personal accounts share the same
 * shape. Named repositories cost one call each and must all be available, otherwise the
 * previous index is retained and the run fails. */
export async function fetchSourceRepos(account: GithubAccount): Promise<GhRepo[]> {
  const { owner, repositories } = account;
  if (!validOwner(owner) || (repositories !== "all" && !repositories.every((name) => validRepoName(name)))) {
    throw new Error("refusing a GitHub source that is not an account name with repository names");
  }
  if (repositories !== "all") {
    const repos: GhRepo[] = [];
    for (const name of repositories) {
      const url = `https://api.github.com/repos/${owner}/${name}`;
      const res = await anonymousGet(url);
      if (res.status === 404) throw new Error(`GitHub repository ${owner}/${name} was not found or is not public`);
      if (!res.ok) throw apiFailure(res, url);
      const repo = await res.json() as GhRepo;
      assertRepoIdentity(repo, owner, name);
      const reason = unavailableReason(repo);
      if (reason) throw new Error(`GitHub repository ${owner}/${name} cannot be indexed: ${reason}`);
      repos.push(repo);
    }
    return repos;
  }

  const all: GhRepo[] = [];
  let accountType = "orgs";
  for (let page = 1; page <= 50; page++) {
    const listUrl = () => `https://api.github.com/${accountType}/${owner}/repos?type=${accountType === "orgs" ? "public" : "owner"}&per_page=100&page=${page}`;
    let url = listUrl();
    let res = await anonymousGet(url);
    if (page === 1 && accountType === "orgs" && res.status === 404) {
      accountType = "users";
      url = listUrl();
      res = await anonymousGet(url);
    }
    if (!res.ok) throw apiFailure(res, url);
    const batch = (await res.json()) as GhRepo[];
    if (!Array.isArray(batch)) throw new Error(`GitHub API returned no list for ${url}`);
    for (const repo of batch) assertRepoIdentity(repo, owner);
    all.push(...batch);
    if (batch.length < 100) break;
    if (page === 50) throw new Error(`GitHub source ${owner} exceeds 5,000 repositories; select specific repositories`);
  }
  return all.filter((r) => r.private === false && r.visibility === "public");
}

/** Is everything about to be written still public? A whole account is listed again; a
 * listed repository is asked of git instead (anonymous `git ls-remote`, which a private
 * or deleted repository refuses), so N listed repositories cost N API calls, not 2N.
 * Returns the problems, if any. */
export async function stillPublic(
  account: GithubAccount,
  repos: { name: string; branch: string }[],
  readsBranch: (owner: string, name: string, branch: string) => boolean = anonymousBranch,
): Promise<string[]> {
  if (account.repositories === "all") {
    const listed = new Set((await fetchSourceRepos(account)).map((r) => r.name.toLowerCase()));
    return repos.filter((r) => !listed.has(r.name.toLowerCase())).map((r) => `${account.owner}/${r.name} is no longer a public repository`);
  }
  return repos
    .filter((r) => !readsBranch(account.owner, r.name, r.branch))
    .map((r) => `${account.owner}/${r.name} is no longer a public repository: git could not read its ${r.branch} branch anonymously`);
}

/** The account's avatar as a data URI: github.com/<owner>.png, redirected to GitHub's
 * avatar host, anonymously. Null when it cannot be had (the caller keeps the last one). */
async function accountAvatar(owner: string): Promise<string | null> {
  for (const size of [256, 160, 96]) {
    let res: Response;
    try {
      res = await anonymousGet(`${accountUrl(owner)}.png?size=${size}`);
    } catch {
      return null;
    }
    const host = new URL(res.url).hostname;
    if (!res.ok || (host !== "github.com" && !host.endsWith(".githubusercontent.com"))) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const type =
      buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff ? "image/jpeg"
      : buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "image/png"
      : null;
    if (!type) return null;
    if (buf.length <= 96 * 1024) return `data:${type};base64,${buf.toString("base64")}`;
  }
  return null;
}

/** The avatar the earlier index at this output gave the same account's root, if any. */
function previousAvatar(owner: string): string | null {
  try {
    const previous = JSON.parse(fs.readFileSync(outFile, "utf8")) as SiteIndex;
    const last = previous.meta.demo ? previous.pages.find((p) => p.depth === 0 && p.path === accountUrl(owner))?.logo : null;
    return typeof last === "string" && last.startsWith("data:image/") ? last : null;
  } catch {
    return null; // no earlier index
  }
}

// ---------------------------------------------------------------- git, with no config

// Git for Windows understands /dev/null, but rejects Node's os.devNull (\\.\nul).
// Keep Git's spelling here; it also works with Git on macOS and Linux.
const GIT_NULL = "/dev/null";
const gitEnv: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: GIT_NULL,
  GIT_CONFIG_NOSYSTEM: "1",
  // Nor the config of a repository around the cache (this project's own): run in a cache
  // folder that is no clone, `git ls-remote` would find that one and apply its URL rewrites.
  GIT_CEILING_DIRECTORIES: cacheRoot,
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "never",
};
for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_ASKPASS", "SSH_ASKPASS", "GIT_CONFIG", "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS", "GH_TOKEN", "GITHUB_TOKEN"]) {
  delete gitEnv[k];
}
const NO_CREDENTIALS = ["-c", "credential.helper=", "-c", "core.askPass=", "-c", `core.hooksPath=${GIT_NULL}`];

function git(cwd: string, args: string[], timeout = 300_000): string {
  cachePath(cwd);
  return execFileSync("git", [...NO_CREDENTIALS, ...args], {
    cwd,
    env: gitEnv,
    encoding: "utf8",
    timeout,
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function tryGit(cwd: string, args: string[]): string | null {
  try {
    return git(cwd, args, 30_000).trim();
  } catch {
    return null;
  }
}

const cacheName = (name: string) => (name.startsWith(".") ? DOT + name.slice(1) : name);
const cloneUrl = (owner: string, name: string) => `${accountUrl(owner)}/${name}.git`;

/** True when git, anonymously and with no config, can read the branch: a private or
 * deleted repository wants a login there is none of, and git fails. */
function anonymousBranch(owner: string, name: string, branch: string): boolean {
  try {
    const refs = git(ownerDir(owner), ["ls-remote", "--heads", "--", cloneUrl(owner, name), `refs/heads/${branch}`], 60_000);
    return refs.split("\n").some((line) => line.endsWith(`\trefs/heads/${branch}`));
  } catch {
    return false;
  }
}

function syncRepo(owner: string, repo: GhRepo, branch: string): void {
  // Asserted here, right before any network fetch, whatever the filters above did.
  if (repo.private !== false || repo.visibility !== "public") throw new Error(`refusing to clone ${owner}/${repo.name}: not public`);
  const parent = ownerDir(owner);
  const dir = cachePath(path.join(parent, cacheName(repo.name)));
  const url = cloneUrl(owner, repo.name);
  const gitDir = path.join(dir, ".git");
  const samePath = (a: string | null, b: string) => !!a && path.relative(path.resolve(dir, a), b) === "";
  const fresh = fs.lstatSync(gitDir, { throwIfNoEntry: false })?.isDirectory()
    && unlinkedTree(gitDir)
    && samePath(tryGit(dir, ["rev-parse", "--show-toplevel"]), dir)
    && samePath(tryGit(dir, ["rev-parse", "--git-common-dir"]), gitDir)
    && tryGit(dir, ["config", "--get", "remote.origin.url"]) === url;
  if (fresh) {
    git(dir, ["fetch", "--quiet", "--depth", String(HISTORY), "--filter=blob:none", "--no-tags", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
    git(dir, ["checkout", "--quiet", "--force", "-B", branch, `refs/remotes/origin/${branch}`]);
    git(dir, ["reset", "--quiet", "--hard"]);
    git(dir, ["clean", "-ffdxq"]);
  } else {
    removeCacheEntry(dir);
    // Blobless: full trees for the history read below, file contents only for the checkout.
    git(parent, ["clone", "--quiet", "--depth", String(HISTORY), "--single-branch", "--branch", branch, "--filter=blob:none", "--no-tags", "--", url, cacheName(repo.name)]);
  }
}

/** True when the history stops at the fetch depth rather than at the first commit. */
function truncated(dir: string): boolean {
  const shallow = path.join(dir, ".git", "shallow");
  if (!fs.existsSync(shallow)) return false;
  return fs
    .readFileSync(shallow, "utf8")
    .split("\n")
    .filter(Boolean)
    .some((sha) => /^parent /m.test(tryGit(dir, ["cat-file", "-p", sha]) ?? ""));
}

// ---------------------------------------------------------------- dates from history

interface Span {
  created: number;
  modified: number;
}

/** Each folder's first and last commit dates, keyed by its path inside the repository
 * ("" for the repository itself), from one `git log --name-only` pass. A file counts from
 * the first commit (within the fetched history) that touched it to the last. */
function folderSpans(dir: string): { folders: Map<string, Span>; repo: Span } {
  const log = git(dir, ["-c", "core.quotePath=false", "log", "--no-renames", "--name-only", "--format=%x1e%aI", "HEAD"]);
  const files = new Map<string, Span>();
  const repo: Span = { created: Infinity, modified: 0 };
  for (const chunk of log.split("\x1e")) {
    const lines = chunk.split("\n");
    const t = Date.parse(lines[0]?.trim() ?? "");
    if (Number.isNaN(t)) continue;
    repo.created = Math.min(repo.created, t);
    repo.modified = Math.max(repo.modified, t);
    for (const raw of lines.slice(1)) {
      const f = raw.trim().normalize("NFC");
      if (!f) continue;
      const s = files.get(f);
      if (s) {
        s.created = Math.min(s.created, t);
        s.modified = Math.max(s.modified, t);
      } else files.set(f, { created: t, modified: t });
    }
  }
  const folders = new Map<string, Span>();
  const tracked = git(dir, ["ls-tree", "-r", "-z", "--name-only", "HEAD"]).split("\0").filter(Boolean);
  for (const raw of tracked) {
    const f = raw.normalize("NFC");
    const segs = f.split("/");
    // Dot files and dot folders are not content to the crawler; they do not date a folder either.
    if (segs.some((s) => s.startsWith("."))) continue;
    const span = files.get(f) ?? repo;
    for (let i = 0; i < segs.length; i++) {
      const key = segs.slice(0, i).join("/");
      const cur = folders.get(key);
      if (cur) {
        cur.created = Math.min(cur.created, span.created);
        cur.modified = Math.max(cur.modified, span.modified);
      } else folders.set(key, { ...span });
    }
  }
  return { folders, repo };
}

const iso = (ms: number) => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null);

// ---------------------------------------------------------------- checks

/** Calls fn for every string in the value, object keys included, with a readable location. */
function walkStrings(value: unknown, fn: (s: string, at: string[]) => void, at: string[] = []): void {
  if (typeof value === "string") fn(value, at);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, fn, [...at, String(i)]));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      fn(k, [...at, "(key)"]);
      walkStrings(v, fn, [...at, k]);
    }
  }
}

// ---------------------------------------------------------------- run

interface Cloned {
  owner: string;
  repo: GhRepo;
  branch: string;
  dir: string;
  truncated: boolean;
  spans: ReturnType<typeof folderSpans>;
}

async function main() {
  const accounts = githubSelection(process.env);
  childPath(projectDir, cacheRoot);
  noLinkedAncestors(projectDir, cacheRoot);
  for (const { owner } of accounts) cachePath(ownerDir(owner));

  // Every account's repositories, all of them checked before the cache is touched.
  const selected: { owner: string; account: GithubAccount; repos: GhRepo[]; skipped: string[] }[] = [];
  for (const account of accounts) {
    const listed = await fetchSourceRepos(account);
    const repos = listed
      .filter((r) => !r.archived && !r.disabled && r.size > 0 && !!r.default_branch)
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    const skipped = listed.filter((r) => !repos.includes(r)).map((r) => `${r.name} (${r.archived ? "archived" : r.disabled ? "disabled" : "empty"})`);
    for (const r of repos) {
      if (!validRepoName(r.name)) throw new Error(`unexpected repository name ${JSON.stringify(r.name)}`);
      if (!/^[A-Za-z0-9._/-]+$/.test(r.default_branch!) || r.default_branch!.includes("..")) throw new Error(`unexpected branch name on ${account.owner}/${r.name}`);
    }
    if (new Set(repos.map((r) => cacheName(r.name).toLowerCase())).size !== repos.length) throw new Error(`two repositories of ${account.owner} map to one cache folder`);
    if (!repos.length) throw new Error(`no public, non-empty repositories found for ${account.owner}`);
    selected.push({ owner: account.owner, account, repos, skipped });
  }
  const owners = selected.map((s) => s.owner);

  // Clone or refresh each, and clear out anything no longer selected: whole accounts
  // first, then repositories within each account.
  fs.mkdirSync(cacheRoot, { recursive: true });
  for (const entry of fs.readdirSync(cacheRoot)) {
    if (!validOwner(entry) || owners.includes(entry)) continue;
    if (holdsOnlyClones(path.join(cacheRoot, entry))) {
      console.log(`removing ${entry} from the cache: not among the selected accounts`);
      removeCacheEntry(path.join(cacheRoot, entry));
    } else console.warn(`leaving ${entry} in the cache: it holds more than clones`);
  }
  const info = new Map<string, Cloned>(); // by "<owner>/<cache folder>"
  for (const { owner, repos, skipped } of selected) {
    console.log(`${repos.length} public repositories in ${owner}${skipped.length ? `, skipping ${skipped.join(", ")}` : ""}`);
    const parent = ownerDir(owner);
    fs.mkdirSync(parent, { recursive: true });
    const wanted = new Set(repos.map((r) => cacheName(r.name)));
    for (const entry of fs.readdirSync(parent)) {
      if (!wanted.has(entry)) {
        console.log(`removing ${entry} from the ${owner} cache: not among the selected public repositories`);
        removeCacheEntry(path.join(parent, entry));
      }
    }
    for (const repo of repos) {
      const branch = repo.default_branch!;
      const t = Date.now();
      syncRepo(owner, repo, branch);
      const dir = path.join(parent, cacheName(repo.name));
      const head = tryGit(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
      if (head !== branch) throw new Error(`${owner}/${repo.name}: expected branch ${branch}, found ${head}`);
      const entry = { owner, repo, branch, dir, truncated: truncated(dir), spans: folderSpans(dir) };
      info.set(`${owner}/${cacheName(repo.name)}`, entry);
      console.log(`  ${repo.name.padEnd(24)} ${branch.padEnd(8)} ${repo.fork ? "fork " : "     "}${entry.truncated ? `last ${HISTORY} commits` : "full history"}  ${Date.now() - t} ms`);
    }
  }
  const clonedOf = (owner: string) => [...info.values()].filter((r) => r.owner === owner);

  // The ordinary crawl, pointed at the cache: one root per account.
  const roots = owners.map(ownerDir);
  if (roots.some((r) => r.includes(","))) throw new Error("the cache path must not contain a comma: the crawler reads its roots as a comma-separated list");
  removeCacheEntry(crawlFile);
  const requireFromProject = createRequire(path.join(projectDir, "package.json"));
  const tsxLoader = pathToFileURL(requireFromProject.resolve("tsx")).href;
  execFileSync(process.execPath, ["--import", tsxLoader, path.join(projectDir, "scripts", "build-index.ts")], {
    cwd: projectDir,
    env: { ...gitEnv, INNERNET_ROOTS: roots.join(","), INNERNET_OUT: crawlFile, INNERNET_MAX_DEPTH: String(MAX_DEPTH) },
    stdio: ["ignore", "inherit", "inherit"],
  });
  const crawled = JSON.parse(fs.readFileSync(crawlFile, "utf8")) as SiteIndex;
  removeCacheEntry(crawlFile);

  // Each crawled root back to its account, by the folder it was crawled from.
  const ownerOfRoot = new Map<string, string>();
  for (const root of crawled.meta.roots) {
    const owner = owners.find((o) => path.resolve(root.path) === ownerDir(o));
    if (!owner) throw new Error("the crawl has a root outside the selected accounts");
    ownerOfRoot.set(root.label, owner);
  }
  const rootPages = new Map<string, Page>();
  for (const p of crawled.pages) {
    if (p.depth !== 0) continue;
    const owner = ownerOfRoot.get(p.root);
    if (!owner || rootPages.has(owner)) throw new Error("the crawl should have exactly one root per account");
    rootPages.set(owner, p);
  }
  if (rootPages.size !== owners.length) throw new Error("the crawl should have exactly one root per account");

  // ------------------------------------------------ paths become GitHub URLs
  const undot = (s: string) => s.split(DOT).join(".");
  const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

  for (const p of crawled.pages) {
    const owner = ownerOfRoot.get(p.root);
    if (!owner) throw new Error(`page ${p.slug} lies outside the selected accounts`);
    const ownerUrl = accountUrl(owner);
    const rel = p.relPath.split(path.sep).join("/");
    const [first, ...rest] = rel ? rel.split("/") : [];
    p.root = rootLabel(owner);
    if (p.depth === 0) {
      p.path = ownerUrl;
      p.relPath = "";
      continue;
    }
    const repo = info.get(`${owner}/${first}`);
    if (!repo) throw new Error(`page ${p.slug} lies outside the public repositories of ${owner}`);
    const inRepo = rest.join("/");
    p.path = inRepo
      ? `${ownerUrl}/${encodeURIComponent(repo.repo.name)}/tree/${encodePath(repo.branch)}/${encodePath(inRepo)}`
      : `${ownerUrl}/${encodeURIComponent(repo.repo.name)}`;
    p.relPath = [repo.repo.name, ...rest].join("/");
    // Dates from history: a fresh clone stamps every file with today.
    const span = repo.spans.folders.get(inRepo.normalize("NFC")) ?? repo.spans.repo;
    p.created = iso(span.created);
    p.modified = iso(span.modified);
    if (p.depth === 1 && repo.repo.fork && !p.categories.includes("Forked repositories")) {
      p.categories.splice(p.categories.indexOf("Git repositories") + 1 || p.categories.length, 0, "Forked repositories");
    }
  }

  // The ".github" stand-in, renamed back everywhere a folder name can surface.
  for (const p of crawled.pages) {
    p.name = undot(p.name);
    p.title = undot(p.title);
    p.slug = undot(p.slug);
    p.parent = p.parent && undot(p.parent);
    p.partOf = p.partOf && undot(p.partOf);
    p.children = p.children.map(undot);
    p.related = p.related.map(undot);
    p.categories = p.categories.map(undot);
  }
  crawled.disambiguation = Object.fromEntries(
    Object.entries(crawled.disambiguation).map(([k, v]) => [undot(k), { primary: v.primary && undot(v.primary), slugs: v.slugs.map(undot) }]),
  );

  for (const [owner, rootPage] of rootPages) {
    // Each root: the account, with its GitHub profile as its README.
    const repoSpans = clonedOf(owner).map((r) => r.spans.repo);
    rootPage.name = owner;
    rootPage.title = owner;
    rootPage.created = iso(Math.min(...repoSpans.map((s) => s.created)));
    rootPage.modified = iso(Math.max(...repoSpans.map((s) => s.modified)));
    const profile = info.get(`${owner}/${cacheName(".github")}`);
    const profileText = profile ? tryGit(profile.dir, ["show", "HEAD:profile/README.md"]) : null;
    if (profileText) {
      rootPage.readme = redactSecrets(profileText.replace(/\r\n/g, "\n").trim().slice(0, README_MAX)) || null;
      rootPage.readmeFile = ".github/profile/README.md";
      rootPage.words = rootPage.readme ? markdownToText(rootPage.readme).split(" ").length : 0;
      if (rootPage.readme && !rootPage.markers.includes("README")) rootPage.markers.push("README");
      if (rootPage.readme) rootPage.categories = rootPage.categories.filter((c) => c !== "Articles lacking a README");
    }

    // Its logo: the account's avatar. Should GitHub not answer, keep the prior avatar
    // only when it belongs to the same account.
    let avatar = await accountAvatar(owner);
    if (!avatar) {
      avatar = previousAvatar(owner);
      console.warn(avatar ? `  could not fetch the avatar of ${owner}; keeping the last one` : `  could not fetch the avatar of ${owner}; its root keeps its sigil`);
    }
    rootPage.logo = avatar;
    rootPage.logoSurface = avatar ? "none" : null;
  }

  const meta: IndexMeta = {
    ...crawled.meta,
    roots: owners.map((owner) => ({ label: rootLabel(owner), path: accountUrl(owner) })),
    durationMs: Date.now() - started,
    demo: {
      org: owners.length === 1 ? owners[0] : "github.com",
      repos: [...info.values()].map(({ owner, repo, branch }) => ({
        name: repo.name,
        url: `${accountUrl(owner)}/${repo.name}`,
        branch,
        fork: repo.fork,
        description: repo.description ? cleanLine(repo.description) : null,
        owner,
      })),
    },
  };
  // Summaries, dash-free text, rolled-up dates and "Started in" categories, as on load.
  const index = normalizeIndex({ meta, pages: crawled.pages, disambiguation: crawled.disambiguation });
  const json = JSON.stringify(index);

  // ------------------------------------------------ checks: nothing from this machine
  const problems: string[] = [];
  const realOr = (p: string) => {
    try {
      return fs.realpathSync(p);
    } catch {
      return p;
    }
  };
  // Never anywhere, not even inside README text. The caches are banned by their clone
  // layout (".github-cache/quirq-ai", for every account), which is what a leaked crawl
  // path holds: their bare names are ordinary words in this project's own README, which
  // documents them.
  const cacheNames = new Set([".demo-cache", ".github-cache", path.relative(projectDir, cacheRoot).split(path.sep).join("/")]);
  const layouts = [...cacheNames].flatMap((c) => owners.map((owner) => `${c}/${owner}`));
  const banned = [...new Set([...roots, cacheRoot, projectDir, ...roots.map(realOr), realOr(projectDir), os.homedir(), realOr(os.homedir()), ...layouts, DOT])].filter(Boolean);
  for (const b of banned) if (json.includes(b)) problems.push(`output contains ${JSON.stringify(b)}`);

  // Path shapes that name a machine. In text quoted from a repository (README, notes,
  // manifest, commit subjects) they pass only when that repository publishes the same
  // path itself; everywhere else they fail outright.
  const LOCAL = /(?:~\/|\/Users\/|\/private\/)[^\s"'`<>()[\]{}|,;*]*/g;
  const QUOTED = new Set(["readme", "summary", "agentNotes", "subject", "manifest", "logo"]);
  const ownerOfLabel = new Map(owners.map((owner) => [rootLabel(owner), owner]));
  const published = new Map<string, boolean>();
  const quotedPaths = new Set<string>(); // home-style paths a repository itself publishes
  const subjects = new Map<string, string>();
  const isPublished = (repoKey: string | undefined, core: string) => {
    const r = repoKey ? info.get(repoKey) : undefined;
    if (!r) return false;
    const key = `${repoKey}\0${core}`;
    if (!published.has(key)) {
      // In a file at HEAD, or in a commit subject: either way, on GitHub already.
      const inTree = tryGit(r.dir, ["grep", "-F", "-q", "-e", core, "HEAD", "--"]) !== null;
      if (!inTree && !subjects.has(repoKey!)) subjects.set(repoKey!, tryGit(r.dir, ["log", "--format=%s", "HEAD"]) ?? "");
      published.set(key, inTree || subjects.get(repoKey!)!.includes(core));
    }
    return published.get(key)!;
  };
  // The repository a page quotes from: its own, or for an account's root, its profile.
  const repoKeyOf = (p: Page) => {
    const owner = ownerOfLabel.get(p.root);
    return owner && `${owner}/${cacheName(p.depth === 0 ? ".github" : p.relPath.split("/")[0])}`;
  };
  const checkLocal = (s: string, at: string[], repoKey: string | undefined) => {
    for (const m of s.matchAll(LOCAL)) {
      // Sentence punctuation after a path is prose, not part of it.
      const core = m[0].replace(/[.:!?]+$/, "");
      const quoted = at.some((k) => QUOTED.has(k));
      if (!quoted || !isPublished(repoKey, core)) problems.push(`${at.join(".")}: ${JSON.stringify(m[0])}`);
      else quotedPaths.add(core);
    }
  };
  index.pages.forEach((p) => walkStrings(p, (s, at) => checkLocal(s, [`pages[${p.slug}]`, ...at], repoKeyOf(p))));
  // Logos travel as base64, which the checks above cannot read: an SVG is text, so it is
  // decoded and held to the same rules as a README quoted from the same repository.
  for (const p of index.pages) {
    const svg = p.logo?.match(/^data:image\/svg\+xml;base64,(.*)$/)?.[1];
    if (!svg) continue;
    const text = Buffer.from(svg, "base64").toString("utf8");
    for (const b of banned) if (text.includes(b)) problems.push(`pages[${p.slug}].logo contains ${JSON.stringify(b)}`);
    checkLocal(text, [`pages[${p.slug}]`, "logo"], repoKeyOf(p));
  }
  walkStrings(index.disambiguation, (s, at) => checkLocal(s, ["disambiguation", ...at], undefined));
  walkStrings({ ...index.meta, demo: { ...index.meta.demo, repos: index.meta.demo!.repos.map((r) => ({ ...r, description: null })) } }, (s, at) =>
    checkLocal(s, ["meta", ...at], undefined),
  );

  // Every page under its own account: its root label, its path, and for a repository,
  // a listed repository of that account with that account's remote.
  const listed = new Map(owners.map((owner) => [owner, new Set<string>()]));
  for (const r of index.meta.demo!.repos) listed.get(r.owner!)!.add(r.name);
  const repoPages = new Map(owners.map((owner) => [owner, 0]));
  for (const p of index.pages) {
    const owner = ownerOfLabel.get(p.root);
    if (!owner) {
      problems.push(`pages[${p.slug}].root is ${JSON.stringify(p.root)}`);
      continue;
    }
    const ownerUrl = accountUrl(owner);
    if (p.depth === 0 ? p.path !== ownerUrl : !p.path.startsWith(`${ownerUrl}/`)) problems.push(`pages[${p.slug}].path is ${JSON.stringify(p.path)}`);
    if (p.depth === 1) {
      repoPages.set(owner, repoPages.get(owner)! + 1);
      if (!listed.get(owner)!.has(p.name)) problems.push(`pages[${p.slug}] is not a listed repository of ${owner}`);
    }
    if (p.git && p.git.remote !== `${ownerUrl}/${p.name}`) problems.push(`pages[${p.slug}].git.remote is ${JSON.stringify(p.git.remote)}`);
  }
  for (const owner of owners) {
    if (repoPages.get(owner) !== listed.get(owner)!.size) problems.push(`repository pages and meta.demo.repos disagree for ${owner}`);
  }

  // Public once more: a repository made private during the run must not ship.
  for (const { owner, account } of selected) {
    problems.push(...(await stillPublic(account, clonedOf(owner).map((r) => ({ name: r.repo.name, branch: r.branch })))));
  }

  if (problems.length) {
    console.error(`demo index NOT written, ${problems.length} problem(s):`);
    for (const pr of problems.slice(0, 40)) console.error(`  ${pr}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const tmp = `${outFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, json);
  fs.renameSync(tmp, outFile);

  const c = index.meta.counts;
  const named = (r: Cloned) => (owners.length > 1 ? `${r.owner}/${r.repo.name}` : r.repo.name);
  const shallow = [...info.values()].filter((r) => r.truncated).map(named);
  const projects = index.pages.filter((p) => p.isArticle && (p.kind === "repo" || p.kind === "project"));
  const avatars = [...rootPages.values()].filter((p) => p.logo).length;
  console.log(
    `demo index: ${info.size} repositories${owners.length > 1 ? ` from ${owners.length} accounts` : ""}, ${c.pages} folders, ${c.articles} articles, ${c.categories} categories, ` +
      `${(json.length / 1024 / 1024).toFixed(2)} MB -> ${path.relative(projectDir, outFile)} in ${Date.now() - started} ms` +
      owners.map((owner) => `\n  ${owner}: ${clonedOf(owner).map((r) => r.repo.name).join(", ")}`).join("") +
      `\n  logos: ${projects.filter((p) => p.logo).length} of ${projects.length} repositories and projects` +
      (owners.length > 1 ? `, and avatars on ${avatars} of ${owners.length} account roots` : avatars ? ", and the account's avatar on the root" : "") +
      (shallow.length ? `\n  history read to the last ${HISTORY} commits for: ${shallow.join(", ")}` : "") +
      (quotedPaths.size ? `\n  paths quoted from the repositories' own text: ${[...quotedPaths].join(", ")}` : ""),
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
