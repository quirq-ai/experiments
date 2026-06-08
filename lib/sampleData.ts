import {
  Branch,
  Commit,
  CommitDetail,
  CommitFileChange,
  RepoState,
} from "./types";

const SUBJECTS = [
  "wire up the wave renderer",
  "tune easing curves",
  "add branch sidebar",
  "smooth the envelope",
  "fix retina scaling",
  "glow pass on the crest",
  "warp the time axis",
  "reduce overdraw",
  "polish hover guide",
  "stream commits on load",
  "refactor scale helpers",
  "drop dead code",
  "rewrite the reducer",
  "calm the motion",
  "balance green and red",
];
const AUTHORS = ["mira", "sol", "june", "kit", "dev"];

export const SAMPLE_BRANCHES: Branch[] = [
  { name: "main", current: true, count: 142 },
  { name: "feat/wave-renderer", current: false, count: 38 },
  { name: "feat/branch-sidebar", current: false, count: 21 },
  { name: "fix/retina-scaling", current: false, count: 9 },
  { name: "experiment/particles", current: false, count: 27 },
  { name: "release/0.1", current: false, count: 64 },
];

function rnd(s: number) {
  const x = Math.sin(s) * 1e4;
  return x - Math.floor(x);
}

export function sampleCommits(branch = "main"): Commit[] {
  const meta = SAMPLE_BRANCHES.find((b) => b.name === branch);
  const n = meta ? Math.max(24, meta.count) : 120;
  const seedBase = branch.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const now = Date.now();
  const span = 1000 * 60 * 60 * 24 * 240;
  const out: Commit[] = [];
  for (let i = 0; i < n; i++) {
    const k = seedBase + i;
    const ts = now - Math.pow(rnd(k * 3.1), 1.6) * span;
    // occasional large refactor commit, mostly small ones
    const big = rnd(k * 1.7) > 0.9 ? 1 : 0;
    const add = Math.floor(2 + Math.pow(rnd(k * 2.3), 3) * (big ? 1400 : 240));
    const del = Math.floor(
      1 + Math.pow(rnd(k * 5.9), 3) * (big ? 900 : 160) * rnd(k * 0.7),
    );
    out.push({
      hash: Math.floor(rnd(k * 4.2) * 0xfffffff)
        .toString(16)
        .padStart(7, "0"),
      author: AUTHORS[Math.floor(rnd(k * 9.4) * AUTHORS.length)],
      ts,
      subject: SUBJECTS[Math.floor(rnd(k * 5.5) * SUBJECTS.length)],
      add,
      del,
    });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

const SAMPLE_PATHS = [
  "components/CommitWave.tsx",
  "app/page.tsx",
  "lib/gitLog.ts",
  "components/BranchSidebar.tsx",
  "app/globals.css",
  "README.md",
];

function fakeSha(seed: number) {
  let s = "";
  for (let i = 0; i < 40; i++) {
    s += Math.floor(Math.abs(Math.sin(seed + i) * 16)).toString(16);
  }
  return s.slice(0, 40);
}

/**
 * Synthesize a full CommitDetail for a sample-mode commit. Real metadata is
 * only available for actual repositories; this fills plausible values so the
 * expanded view is populated in the demo.
 */
export function sampleDetail(c: Commit): CommitDetail {
  const seed = parseInt(c.hash, 16) || 1;
  // Split the churn across a few files.
  const fileCount = Math.max(1, Math.min(SAMPLE_PATHS.length, 1 + (seed % 4)));
  const files: CommitFileChange[] = [];
  let aLeft = c.add;
  let dLeft = c.del;
  for (let i = 0; i < fileCount; i++) {
    const last = i === fileCount - 1;
    const a = last ? aLeft : Math.floor(aLeft / (fileCount - i));
    const d = last ? dLeft : Math.floor(dLeft / (fileCount - i));
    aLeft -= a;
    dLeft -= d;
    files.push({
      path: SAMPLE_PATHS[(seed + i) % SAMPLE_PATHS.length],
      add: a,
      del: d,
      binary: false,
    });
  }
  const iso = new Date(c.ts).toISOString();
  return {
    hash: fakeSha(seed),
    shortHash: c.hash,
    tree: fakeSha(seed + 1),
    parents: [fakeSha(seed + 2).slice(0, 40)],
    author: { name: c.author, email: `${c.author}@example.com`, date: iso },
    committer: { name: c.author, email: `${c.author}@example.com`, date: iso },
    subject: c.subject,
    body: "(sample data) Full commit message body, signatures, and notes are only available when a real repository is loaded.",
    refs: [],
    signature: { status: "N" },
    files,
    totalAdd: c.add,
    totalDel: c.del,
    filesChanged: files.length,
    source: "sample",
  };
}

/** A plausible "current state" for sample mode: clean tree on main at HEAD. */
export function sampleState(): RepoState {
  const cs = sampleCommits("main");
  const head = cs[cs.length - 1];
  const seed = parseInt(head.hash, 16) || 1;
  return {
    branch: "main",
    detached: false,
    head: {
      hash: fakeSha(seed),
      shortHash: head.hash,
      subject: head.subject,
      author: head.author,
      date: new Date(head.ts).toISOString(),
    },
    dirty: false,
    staged: 0,
    unstaged: 0,
    untracked: 0,
    ahead: 0,
    behind: 0,
    upstream: "origin/main",
    workingAdd: 0,
    workingDel: 0,
    source: "sample",
  };
}
