// Remote input: a collection of public GitHub repositories, from any account, each as
// "owner/name". There is no whole-account mode: a sync fetches exactly what is listed.

export interface RemoteConfig {
  /** Canonical "owner/name" entries, lowercase, deduplicated and sorted. */
  repositories: string[];
  /** Set when the saved settings named a whole account, which is no longer a choice: the
   * list stays empty until repositories are added, and Sources says why. */
  legacyAccount?: string;
}

export const EMPTY_REMOTE: RemoteConfig = { repositories: [] };

export const MAX_REPOSITORIES = 50;

const OWNER = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/;
const NAME = /^[a-z\d._-]{1,100}$/;

function validOwner(owner: string): boolean {
  return OWNER.test(owner) && !owner.includes("--");
}

function validName(name: string): boolean {
  return NAME.test(name) && name !== "." && name !== ".." && !name.includes("__dot__");
}

/** One entry, as a link (https://github.com/owner/name, .git or a trailing slash allowed)
 * or as owner/name, to its canonical form. Throws a sentence the form can show. */
export function parseRepository(entry: string): string {
  const input = entry.trim();
  let parts: string[];
  if (/^https?:\/\//i.test(input)) {
    if (/[\\%]/.test(input) || input.split("/").some((part) => part === "." || part === "..")) {
      throw new Error(`${input} has escaped or relative path segments.`);
    }
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw new Error(`${input} is not a link.`);
    }
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.port || url.username || url.password || url.search || url.hash) {
      throw new Error(`${input} is not a public https://github.com link.`);
    }
    parts = url.pathname.replace(/\/+$/, "").slice(1).split("/");
  } else {
    parts = input.replace(/^github\.com\//i, "").split("/");
  }
  if (parts.length !== 2) throw new Error(`${input} is not a repository: use https://github.com/owner/name or owner/name.`);
  const owner = parts[0].toLowerCase();
  const name = parts[1].replace(/\.git$/i, "").toLowerCase();
  if (!validOwner(owner)) throw new Error(`${parts[0]} is not a GitHub account name.`);
  if (!validName(name)) throw new Error(`${parts[1]} is not a repository name.`);
  return `${owner}/${name}`;
}

/** Saved or submitted settings to their canonical form. Accepts the old shape too
 * ({ owner, repositories: names }): names become owner/name, and a whole account is
 * remembered in `legacyAccount` with an empty list. Throws a sentence the form can show. */
export function normalizeRemoteConfig(value: unknown): RemoteConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter your GitHub repositories, one link per line.");
  const remote = value as Record<string, unknown>;
  if (!Array.isArray(remote.repositories)) throw new Error("Enter your GitHub repositories, one link per line.");
  if (remote.repositories.length > MAX_REPOSITORIES) throw new Error(`List at most ${MAX_REPOSITORIES} repositories.`);
  if (remote.repositories.some((entry) => typeof entry !== "string")) throw new Error("Repository links must be text.");
  const entries = (remote.repositories as string[]).map((entry) => entry.trim()).filter(Boolean);

  // The old shape: an account, and names inside it (or none, for every repository).
  if (typeof remote.owner === "string" && remote.owner.trim()) {
    const ownerInput = remote.owner.trim().replace(/^https:\/\/github\.com\//i, "").replace(/\/+$/, "").toLowerCase();
    if (!validOwner(ownerInput)) throw new Error("The saved GitHub account is not a valid account name.");
    if (!entries.length) return { repositories: [], legacyAccount: ownerInput };
    const repositories = entries.map((entry) => parseRepository(entry.includes("/") ? entry : `${ownerInput}/${entry}`));
    return { repositories: [...new Set(repositories)].sort() };
  }

  const repositories = entries.map(parseRepository);
  return { repositories: [...new Set(repositories)].sort() };
}

/** The accounts a collection draws on, in order. */
export const remoteOwners = (remote: RemoteConfig) => [...new Set(remote.repositories.map((r) => r.split("/")[0]))];

/** Activity lines are capped at 4 KB; the complete list lives in the source settings. */
export function remoteActivityFields(remote: RemoteConfig) {
  return { repositoryCount: remote.repositories.length, repositories: remote.repositories.slice(0, 5) };
}
