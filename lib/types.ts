// The index contract. Written by scripts/build-index.ts, read by lib/data.ts.
// Everything here is plain JSON so the index can be inspected by hand.

export type PageKind =
  | "repo" // has its own .git
  | "project" // a manifest, pubspec.yaml, a README of 25+ words, or agent notes (CLAUDE.md / AGENTS.md)
  | "agent" // a dot folder (.claude, .codex, .xo...): what an agent or tool keeps inside an indexed source
  | "docs" // 2+ files, at least 60% documents (md, pdf, txt, html, docx...)
  | "assets" // mostly images, video, audio
  | "code" // source folder inside a project (src, components, lib...)
  | "folder"; // everything else

/** The top-level classification. A dot folder and everything inside it belongs to an
 * agent; everything else is a project's. */
export type Realm = "project" | "agent";

/** An instruction or memory file inside an agent's folder (CLAUDE.md, AGENTS.md, SOUL.md,
 * memory/*.md...), its text trimmed and with credentials redacted. */
export interface AgentFile {
  path: string; // relative to the agent's folder, "/" separated
  text: string; // markdown, trimmed to a few KB
  words: number;
  modified: string | null; // ISO
}

/** A session or transcript file, known by its name, size and dates only. */
export interface AgentSession {
  path: string; // relative to the agent's folder
  date: string; // ISO, last written
  bytes: number;
}

export interface AgentInfo {
  tool: string; // what keeps the folder: "Claude Code", "Codex", "XO"... or the bare name
  instructions: AgentFile[]; // instructions first, then memory, newest memory first
  sessions: {
    count: number;
    bytes: number;
    first: string | null; // ISO
    last: string | null; // ISO
    monthly: { month: string; count: number }[]; // last 24 months, oldest first, by last write
    recent: AgentSession[]; // newest first, up to 8
  } | null; // null: no session or transcript files
  activity: {
    files: number; // files read for this summary
    last: string | null; // ISO, newest file write
    recent: number; // files written in the 30 days before indexing
    monthly: { month: string; count: number }[]; // files by month of last write, last 24 months
    logs: AgentSession[]; // activity logs (history.jsonl, timeline.jsonl...), newest first, up to 5
  };
}

export interface Commit {
  hash: string; // short
  date: string; // ISO
  subject: string;
  author: string;
}

export interface GitInfo {
  branch: string | null;
  remote: string | null; // credentials stripped
  commitCount: number;
  firstCommit: string | null; // ISO
  lastCommit: string | null; // ISO
  recent: Commit[]; // newest first, up to 15
  authors: { name: string; commits: number }[]; // the 8 most active
  authorCount?: number; // all authors of the commits read; absent in indexes built before it existed
  monthly: { month: string; count: number }[]; // "2026-03", last 24 months, oldest first
  onThisDay: Commit[]; // commits made on today's month/day in earlier years (computed at index time)
}

export interface Manifest {
  file: "package.json" | "pyproject.toml" | "Cargo.toml" | "go.mod" | "requirements.txt";
  name: string | null;
  version: string | null;
  description: string | null;
  scripts: string[];
  dependencies: string[];
  devDependencies: string[];
}

export interface Page {
  slug: string; // wiki slug, e.g. "linear-clone" or "components_(linear-clone)"
  name: string; // folder name as on disk
  title: string; // display title: the folder name, or "name (qualifier)" for a namesake that is not the primary topic
  path: string; // absolute path on disk
  relPath: string; // path relative to its root, "" for a root
  root: string; // display label of the root, e.g. "~/Programming"
  depth: number; // 0 for a root
  kind: PageKind;
  realm: Realm; // "agent" for a dot folder and anything inside one (lib/normalize.ts realmOf)
  isArticle: boolean; // true: full article. false: stub.
  parent: string | null; // slug
  partOf: string | null; // slug of the nearest enclosing project (has a manifest), if any
  children: string[]; // slugs of indexed subfolders
  hiddenChildren: string[]; // names of pruned subfolders (node_modules, .git, dist...)
  files: string[]; // up to 24 direct file names (secret-looking names removed)
  fileCount: number; // direct files
  totalFiles: number; // files in this folder and its descendants
  bytes: number; // bytes of direct files
  totalBytes: number; // bytes in this folder and its descendants
  // Below the indexer's depth limit: subfolders counted but not indexed. Absent when
  // nothing lies below, and in indexes built before it existed.
  deeper?: { names: string[]; folders: number; files: number };
  docFiles?: number; // document files (md, html, pdf, txt...) in the subtree; absent in older indexes
  created: string | null; // ISO, earliest birthtime seen in subtree
  modified: string | null; // ISO, latest mtime seen in subtree
  languages: { name: string; files: number }[]; // subtree, sorted desc, top 8
  markers: string[]; // e.g. ["git", "package.json", "next", "README", "CLAUDE.md"]
  frameworks: string[]; // e.g. ["Next.js", "React", "Tailwind CSS"]
  manifest: Manifest | null;
  summary: string | null; // one plain-text paragraph, <= 420 chars
  readme: string | null; // README markdown, trimmed to ~14KB
  readmeFile: string | null;
  agentNotes: string | null; // first paragraph of CLAUDE.md / AGENTS.md
  git: GitInfo | null;
  categories: string[];
  related: string[]; // slugs, "See also"
  words: number; // README word count
  // The project's own logo, found by name in its folder (logo, icon, mark, favicon...)
  // and embedded as a base64 data URI, so no page ever fetches it. Repositories and
  // projects only; on the demo's root, the organisation's GitHub avatar. Absent or null:
  // the letter sigil stands in. Always drawn with <img>, never as inline markup.
  logo?: string | null;
  // The tile a logo wants beneath it, read from its colours at index time: "dark" for a
  // mark drawn in light ink, "light" for one drawn in dark ink, "none" for an opaque
  // picture that fills its tile edge to edge. Absent: any quiet surface will do.
  logoSurface?: LogoSurface | null;
  // On an agent's own folder (kind "agent"): its instructions, memory, sessions and
  // activity. Session files are known by name, size and date; their contents are never read.
  agent?: AgentInfo | null;
}

export type LogoSurface = "dark" | "light" | "none";

export interface IndexMeta {
  generatedAt: string; // ISO
  roots: { label: string; path: string }[];
  maxDepth: number;
  deeperCounted?: boolean; // true when folders past maxDepth are tallied into `deeper`
  /** Set on an index brought down from a connected remote database (lib/db/remote-sync.ts):
   * this machine follows the remote's newer ones, and never sends it back up. */
  fromRemote?: boolean;
  counts: { pages: number; articles: number; repos: number; stubs: number; categories: number; agents?: number };
  durationMs: number;
  /** Present on a GitHub index (the demo's data/demo/index.json, or a Sources snapshot in
   * data/github-*.json): which public repositories it holds. Every page's `path` is its
   * GitHub URL, never a local path. `org` names the one account, or "github.com" when the
   * repositories come from several; each repository names its own `owner`. */
  demo?: {
    org: string;
    repos: { name: string; url: string; branch: string; fork: boolean; description: string | null; owner?: string }[];
  };
}

export interface SiteIndex {
  meta: IndexMeta;
  pages: Page[];
  // Folder names shared by several folders. Keyed by the bare slug (e.g. "src").
  // When one folder is clearly the primary topic it keeps the bare slug and the list
  // lives at "<name>_(disambiguation)"; otherwise the bare slug is the list itself.
  disambiguation: Record<string, { primary: string | null; slugs: string[] }>;
}
