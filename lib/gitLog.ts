import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  Branch,
  Commit,
  CommitDetail,
  CommitFileChange,
  RepoState,
} from "./types";

const run = promisify(execFile);

const SEP = "\x1f";
const REC = "\x1e";

export function isGitRepo(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

/** Parse `git show --numstat` body lines into per-file changes. */
function parseNumstat(body: string): CommitFileChange[] {
  const files: CommitFileChange[] = [];
  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const binary = parts[0] === "-" || parts[1] === "-";
    const add = binary ? -1 : parseInt(parts[0], 10) || 0;
    const del = binary ? -1 : parseInt(parts[1], 10) || 0;
    // Renames look like "old => new" or "dir/{old => new}/file".
    let path = parts[2];
    let oldPath: string | undefined;
    const arrow = path.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
    if (arrow) {
      oldPath = `${arrow[1]}${arrow[2]}${arrow[4]}`.replace(/\/\//g, "/");
      path = `${arrow[1]}${arrow[3]}${arrow[4]}`.replace(/\/\//g, "/");
    } else if (path.includes(" => ")) {
      const [o, nw] = path.split(" => ");
      oldPath = o;
      path = nw;
    }
    files.push({ path, oldPath, add, del, binary });
  }
  return files;
}

/** Full metadata for one commit: everything git readily exposes. */
export async function readCommitDetail(
  dir: string,
  hash: string,
): Promise<CommitDetail> {
  const fields = [
    "%H", "%h", "%T", "%P",
    "%an", "%ae", "%aI",
    "%cn", "%ce", "%cI",
    "%D", "%e", "%G?", "%GS", "%GK",
    "%s", "%b",
  ].join(SEP);

  const { stdout: head } = await run(
    "git",
    ["-C", dir, "show", "--no-patch", `--format=${fields}`, hash],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  const p = head.replace(/\n$/, "").split(SEP);
  const [
    H, h, T, P, an, ae, aI, cn, ce, cI, D, enc, gq, gs, gk, subject,
  ] = p;
  const body = p.slice(16).join(SEP).trim();

  const { stdout: nstat } = await run(
    "git",
    ["-C", dir, "show", "--numstat", "--format=", hash],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const files = parseNumstat(nstat);
  const totalAdd = files.reduce((a, f) => a + Math.max(0, f.add), 0);
  const totalDel = files.reduce((a, f) => a + Math.max(0, f.del), 0);

  let notes: string | undefined;
  try {
    const { stdout } = await run("git", ["-C", dir, "notes", "show", hash], {
      maxBuffer: 1024 * 1024,
    });
    notes = stdout.trim() || undefined;
  } catch {
    notes = undefined;
  }

  return {
    hash: H,
    shortHash: h,
    tree: T,
    parents: P ? P.trim().split(/\s+/).filter(Boolean) : [],
    author: { name: an, email: ae, date: aI },
    committer: { name: cn, email: ce, date: cI },
    subject: subject ?? "",
    body,
    refs: D ? D.split(",").map((r) => r.trim()).filter(Boolean) : [],
    encoding: enc || undefined,
    signature: { status: gq || "N", signer: gs || undefined, key: gk || undefined },
    notes,
    files,
    totalAdd,
    totalDel,
    filesChanged: files.length,
    source: "git",
  };
}

export async function listBranches(dir: string): Promise<Branch[]> {
  const { stdout } = await run(
    "git",
    [
      "-C",
      dir,
      "for-each-ref",
      "--sort=-committerdate",
      "--format=%(HEAD)%1f%(refname:short)",
      "refs/heads",
    ],
    { maxBuffer: 8 * 1024 * 1024 },
  );

  const branches: Branch[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const [head, name] = line.split(SEP);
    if (!name) continue;
    let count = 0;
    try {
      const r = await run("git", ["-C", dir, "rev-list", "--count", name], {
        maxBuffer: 1024 * 1024,
      });
      count = parseInt(r.stdout.trim(), 10) || 0;
    } catch {
      count = 0;
    }
    branches.push({ name, current: head.trim() === "*", count });
  }
  return branches;
}

export async function readGitLog(
  dir: string,
  branch?: string,
  opts: { skip?: number; limit?: number } = {},
): Promise<Commit[]> {
  const { skip = 0, limit = 4000 } = opts;
  // Record separator goes at the START of each commit so that the --numstat
  // body, which git prints AFTER the header line, stays inside the same record
  // when we split on REC. (With REC at the end, each commit's numstat would be
  // grouped with the next commit's header and misparsed.)
  const format = REC + ["%H", "%an", "%at", "%s"].join(SEP);
  // Walk back from HEAD: --skip past the newer commits already loaded, then take
  // the next window. --no-merges keeps the skip/limit accounting consistent
  // across calls (both are counted over the same merge-filtered list).
  const args = [
    "-C",
    dir,
    "log",
    "--no-merges",
    `--skip=${skip}`,
    `--max-count=${limit}`,
    "--numstat",
    `--pretty=format:${format}`,
  ];
  if (branch) args.push(branch);

  const { stdout } = await run("git", args, { maxBuffer: 64 * 1024 * 1024 });

  const commits: Commit[] = [];
  for (const block of stdout.split(REC)) {
    const trimmed = block.replace(/^\n+/, "");
    if (!trimmed) continue;
    const nl = trimmed.indexOf("\n");
    const headerLine = nl === -1 ? trimmed : trimmed.slice(0, nl);
    const body = nl === -1 ? "" : trimmed.slice(nl + 1);
    const [hash, author, at, subject = ""] = headerLine.split(SEP);
    if (!hash) continue;

    let add = 0;
    let del = 0;
    for (const line of body.split("\n")) {
      if (!line.trim()) continue;
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      const a = parseInt(parts[0], 10);
      const d = parseInt(parts[1], 10);
      if (!isNaN(a)) add += a;
      if (!isNaN(d)) del += d;
    }

    commits.push({
      hash: hash.slice(0, 7),
      fullHash: hash,
      author: author || "unknown",
      ts: (parseInt(at, 10) || 0) * 1000,
      subject,
      add,
      del,
    });
  }
  return commits.sort((a, b) => a.ts - b.ts);
}

/**
 * The repo's "current state": the branch + HEAD commit it's sitting on, plus
 * whether the working tree is dirty (staged / unstaged / untracked) and how far
 * ahead/behind its upstream it is. This is what running the repo as-is reflects.
 */
export async function readRepoState(dir: string): Promise<RepoState> {
  let branch = "";
  let detached = false;
  try {
    const { stdout } = await run("git", [
      "-C",
      dir,
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ]);
    branch = stdout.trim();
  } catch {
    branch = "";
  }
  if (!branch || branch === "HEAD") {
    detached = true;
    branch = "(detached HEAD)";
  }

  const { stdout: h } = await run("git", [
    "-C",
    dir,
    "log",
    "-1",
    `--pretty=%H${SEP}%h${SEP}%an${SEP}%aI${SEP}%s`,
  ]);
  const [H, sh, an, aI, subj] = h.replace(/\n$/, "").split(SEP);

  let staged = 0;
  let unstaged = 0;
  let untracked = 0;
  let ahead = 0;
  let behind = 0;
  let upstream: string | undefined;
  try {
    const { stdout: st } = await run(
      "git",
      ["-C", dir, "status", "--porcelain=v1", "--branch"],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    for (const line of st.split("\n")) {
      if (!line) continue;
      if (line.startsWith("##")) {
        const m = line.match(/\.\.\.(\S+)/);
        if (m) upstream = m[1];
        const a = line.match(/ahead (\d+)/);
        if (a) ahead = parseInt(a[1], 10);
        const b = line.match(/behind (\d+)/);
        if (b) behind = parseInt(b[1], 10);
        continue;
      }
      if (line.startsWith("??")) {
        untracked++;
        continue;
      }
      const x = line[0];
      const y = line[1];
      if (x !== " " && x !== "?") staged++;
      if (y !== " " && y !== "?") unstaged++;
    }
  } catch {
    /* status unavailable */
  }

  let workingAdd = 0;
  let workingDel = 0;
  try {
    const { stdout: nd } = await run(
      "git",
      ["-C", dir, "diff", "HEAD", "--numstat"],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    for (const line of nd.split("\n")) {
      if (!line.trim()) continue;
      const p = line.split("\t");
      if (p.length < 3) continue;
      const a = parseInt(p[0], 10);
      const d = parseInt(p[1], 10);
      if (!isNaN(a)) workingAdd += a;
      if (!isNaN(d)) workingDel += d;
    }
  } catch {
    /* diff unavailable */
  }

  return {
    branch,
    detached,
    head: {
      hash: H,
      shortHash: sh,
      subject: subj ?? "",
      author: an,
      date: aI,
    },
    dirty: staged + unstaged + untracked > 0,
    staged,
    unstaged,
    untracked,
    ahead,
    behind,
    upstream,
    workingAdd,
    workingDel,
    source: "git",
  };
}
