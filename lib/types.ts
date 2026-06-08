export interface Commit {
  hash: string; // abbreviated hash, for display
  fullHash?: string; // full 40-char SHA, used for unambiguous git lookups
  author: string;
  ts: number; // epoch ms
  subject: string;
  add: number; // insertions
  del: number; // deletions
}

export interface Branch {
  name: string;
  current: boolean;
  count: number; // commits on this branch
}

export interface CommitPayload {
  repo: string;
  branch: string;
  source: "git" | "sample";
  commits: Commit[]; // one window, oldest to newest
  skip?: number; // how many newer commits were skipped (from HEAD)
  limit?: number; // window size requested
  hasMore?: boolean; // older history exists beyond this window
}

export interface BranchPayload {
  repo: string;
  source: "git" | "sample";
  branches: Branch[];
}

export interface CommitFileChange {
  path: string;
  oldPath?: string; // set on renames
  add: number; // -1 for binary
  del: number; // -1 for binary
  binary: boolean;
}

/** Full metadata for a single commit, as much as git exposes. */
export interface CommitDetail {
  hash: string;
  shortHash: string;
  tree: string;
  parents: string[];
  author: { name: string; email: string; date: string };
  committer: { name: string; email: string; date: string };
  subject: string;
  body: string;
  refs: string[]; // branch/tag decorations
  encoding?: string;
  signature: { status: string; signer?: string; key?: string };
  notes?: string;
  files: CommitFileChange[];
  totalAdd: number;
  totalDel: number;
  filesChanged: number;
  source: "git" | "sample";
}

export interface CommitDetailPayload {
  detail: CommitDetail;
}

/** The repo's working state right now: HEAD plus any uncommitted changes. */
export interface RepoState {
  branch: string; // current branch, or "(detached)" label
  detached: boolean;
  head: {
    hash: string;
    shortHash: string;
    subject: string;
    author: string;
    date: string;
  };
  dirty: boolean;
  staged: number;
  unstaged: number;
  untracked: number;
  ahead: number;
  behind: number;
  upstream?: string;
  workingAdd: number; // +lines uncommitted vs HEAD
  workingDel: number; // -lines uncommitted vs HEAD
  source: "git" | "sample";
}

export interface RepoStatePayload {
  state: RepoState;
}
