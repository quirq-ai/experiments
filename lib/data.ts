import "server-only";

import fs from "node:fs";
import { heldLocalIndex, rememberLocalIndex, remoteDemoIndex } from "./db/sync";
import { mergeIndexes } from "./merge-indexes";
import { DEMO } from "./mode";
import { normalizeIndex } from "./normalize";
import { BUNDLED_REMOTE_INDEX_FILE, LOCAL_INDEX_FILE, readSourceSelection, remoteIndexFile } from "./sources";
import type { Page, SiteIndex } from "./types";

// Local mode combines the selected sources from data/sources.json: data/index.json
// for folders and data/github-<hash>.json, the snapshot of the listed repositories, for
// GitHub. Changed files and source selections take effect without restarting the server.
// The public demo keeps its original bundled-file / Neon flow.
//
// The database (lib/db) keeps a copy, and the file stays the source. On this machine
// each new local-folder index is stored in the background, and if data/index.json goes missing the
// stored one serves instead. On the demo a newer index stored in Neon replaces the
// bundled one once it has been read (lib/db/sync.ts). getIndex() itself never waits on
// a database: it answers from memory.

export interface Loaded {
  index: SiteIndex;
  missing: boolean; // true when there is no index to show: none built yet, and none stored
  version: number; // changes whenever the served source selection or index changes
  source: "file" | "database" | "none"; // where the index served came from
  bySlug: Map<string, Page>;
  byLowerSlug: Map<string, Page>;
  categories: Map<string, Page[]>; // category -> articles, sorted by title
  articles: Page[];
  byName: Map<string, Page[]>; // lowercased folder name -> every folder of that name
}

let serial = 0;
const fromFileCache = new Map<string, { signature: string; loaded: Loaded }>();
let fromDbCache: { heldVersion: number; index: SiteIndex; loaded: Loaded } | null = null;
let selectedCache: { selection: string; local: Loaded | null; remote: Loaded | null; loaded: Loaded } | null = null;

const EMPTY: SiteIndex = {
  meta: { generatedAt: "", roots: [], maxDepth: 0, counts: { pages: 0, articles: 0, repos: 0, stubs: 0, categories: 0 }, durationMs: 0 },
  pages: [],
  disambiguation: {},
};

function build(index: SiteIndex, version: number, source: Loaded["source"]): Loaded {
  const bySlug = new Map(index.pages.map((p) => [p.slug, p]));
  const byLowerSlug = new Map(index.pages.map((p) => [p.slug.toLowerCase(), p]));
  const categories = new Map<string, Page[]>();
  for (const p of index.pages) {
    for (const c of p.categories) categories.set(c, [...(categories.get(c) ?? []), p]);
  }
  for (const list of categories.values()) list.sort((a, b) => a.title.localeCompare(b.title));
  const byName = new Map<string, Page[]>();
  for (const p of index.pages) byName.set(p.name.toLowerCase(), [...(byName.get(p.name.toLowerCase()) ?? []), p]);
  return {
    index,
    missing: source === "none",
    version,
    source,
    bySlug,
    byLowerSlug,
    categories,
    articles: index.pages.filter((p) => p.isArticle),
    byName,
  };
}

const NONE = build(EMPTY, -1, "none");

/** Reload changed files; only the original local index is copied to the database. */
function fromFile(file: string): Loaded | null {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    /* not built yet, or deleted */
    fromFileCache.delete(file);
    return null;
  }
  const signature = `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
  const cached = fromFileCache.get(file);
  if (cached?.signature === signature) return cached.loaded;
  // Older indexes are brought up to the current rules on load: no credentials, no
  // dashes, UTC dates rolled up the tree (see lib/normalize.ts).
  const index = normalizeIndex(JSON.parse(fs.readFileSync(file, "utf8")));
  const loaded = build(index, ++serial, "file");
  fromFileCache.set(file, { signature, loaded });
  if (!DEMO && file === LOCAL_INDEX_FILE) rememberLocalIndex(index, loaded.version);
  return loaded;
}

/** An index the database holds, built once per version. */
function fromDb(held: { index: SiteIndex; version: number }): Loaded {
  if (fromDbCache?.heldVersion === held.version && fromDbCache.index === held.index) return fromDbCache.loaded;
  const loaded = build(normalizeIndex(held.index), ++serial, "database");
  fromDbCache = { heldVersion: held.version, index: held.index, loaded };
  return loaded;
}

/** The raw local index, independent of selected sources, for database storage. */
export function getLocalIndex(): Loaded {
  const file = fromFile(LOCAL_INDEX_FILE);
  if (file) return file;
  const held = heldLocalIndex();
  return held ? fromDb(held) : NONE;
}

export function getIndex(): Loaded {
  if (DEMO) {
    const file = fromFile(BUNDLED_REMOTE_INDEX_FILE);
    const remote = remoteDemoIndex(file?.index.meta.generatedAt ?? "");
    return remote ? fromDb(remote) : (file ?? NONE);
  }
  const selection = readSourceSelection();
  const key = `${selection.local}:${selection.remote}`;
  const local = selection.local ? getLocalIndex() : null;
  let remote: Loaded | null = null;
  if (selection.remote) {
    try {
      const file = remoteIndexFile();
      remote = file ? fromFile(file) : null;
    } catch {
      /* Sources remains available to repair invalid settings or rebuild a broken snapshot. */
    }
  }
  if (selectedCache?.selection === key && selectedCache.local === local && selectedCache.remote === remote) return selectedCache.loaded;
  const localIndex = local && !local.missing ? local.index : null;
  const source = remote ? "file" : local?.source ?? "none";
  // Normalise before merging: existing categories and all link targets already belong
  // to their correct source. Never send this derived view to rememberLocalIndex.
  const index = mergeIndexes(localIndex, remote?.index ?? null);
  const loaded = build(index, ++serial, source);
  selectedCache = { selection: key, local, remote, loaded };
  return loaded;
}

export function getPage(slug: string | null | undefined): Page | null {
  if (!slug) return null;
  const { bySlug, byLowerSlug } = getIndex();
  return bySlug.get(slug) ?? byLowerSlug.get(slug.toLowerCase()) ?? null;
}

export function getPages(slugs: string[]): Page[] {
  return slugs.map(getPage).filter((p): p is Page => !!p);
}

/** Root first, page itself excluded. */
export function ancestors(page: Page): Page[] {
  const out: Page[] = [];
  let cur = getPage(page.parent);
  while (cur) {
    out.unshift(cur);
    cur = getPage(cur.parent);
  }
  return out;
}

export type Resolved =
  | { type: "page"; page: Page; disambiguation: string | null } // disambiguation: slug of the list page when this page is a primary topic
  | { type: "disambiguation"; name: string; primary: Page | null; pages: Page[] }
  | { type: "category"; name: string; pages: Page[] }
  | { type: "special"; name: string }
  | { type: "missing"; slug: string };

/** Decode a [slug] route param and work out what it names. */
export function resolveSlug(param: string): Resolved {
  let slug = param;
  try {
    slug = decodeURIComponent(param);
  } catch {
    /* already decoded */
  }
  const { index, categories } = getIndex();

  if (/^special:/i.test(slug)) return { type: "special", name: slug.slice(8) };
  if (/^category:/i.test(slug)) {
    // categoryHref writes spaces as underscores, and names can hold real underscores
    // ("Parts of NM_gen"), so compare with both read as spaces.
    const want = slug.slice(9).replace(/_/g, " ").toLowerCase();
    const hit = [...categories.keys()].find((c) => c.replace(/_/g, " ").toLowerCase() === want);
    return hit ? { type: "category", name: hit, pages: categories.get(hit)! } : { type: "missing", slug };
  }

  const dis = (key: string) => {
    const k = Object.keys(index.disambiguation).find((d) => d.toLowerCase() === key.toLowerCase());
    return k ? { key: k, entry: index.disambiguation[k] } : null;
  };
  // The folder name itself: keys write spaces as underscores, but so do real names.
  const shared = (d: { key: string; entry: { slugs: string[] } }) => getPage(d.entry.slugs[0])?.name ?? d.key.replace(/_/g, " ");

  const explicit = slug.match(/^(.*)_\(disambiguation\)$/i);
  if (explicit) {
    const d = dis(explicit[1]);
    if (d) return { type: "disambiguation", name: shared(d), primary: getPage(d.entry.primary), pages: getPages(d.entry.slugs) };
  }

  const page = getPage(slug);
  if (page) {
    const d = dis(page.slug);
    return { type: "page", page, disambiguation: d && d.entry.primary === page.slug ? `${d.key}_(disambiguation)` : null };
  }

  const d = dis(slug);
  if (d) return { type: "disambiguation", name: shared(d), primary: getPage(d.entry.primary), pages: getPages(d.entry.slugs) };
  return { type: "missing", slug };
}

/** Any article, uniformly at random. Used by Special:Random and "I'm feeling curious". */
export function randomArticle(): Page | null {
  const { articles } = getIndex();
  if (!articles.length) return null;
  return articles[Math.floor(Math.random() * articles.length)];
}
