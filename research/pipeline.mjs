// Research → posts pipeline: collect a folder (any format), ask Claude for a
// carousel post, render its slides to SVG, and build an Instants seed.
import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const run = promisify(execFile);
// Bundled by Next, import.meta.dirname is undefined; the server runs from the app root.
const APP_ROOT = import.meta.dirname ? path.resolve(import.meta.dirname, "..") : process.cwd();
export const CACHE_DIR = path.join(APP_ROOT, ".research-cache");
export const SLIDE_DIR = path.join(APP_ROOT, "public", "research");
export const SEED_FILE = path.join(APP_ROOT, "data", "research.json");

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out", ".vercel",
  ".turbo", "coverage", ".cache", "__pycache__", ".venv", "venv",
  ".research-cache", ".instants", "target",
]);
const DOC_EXT = new Set([".md", ".mdx", ".txt", ".rst", ".org"]);
const DATA_EXT = new Set([".json", ".jsonl", ".csv", ".tsv", ".yaml", ".yml", ".toml"]);
const MARKUP_EXT = new Set([".html", ".htm", ".xml", ".svg"]);
const CODE_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".rs", ".go", ".swift",
  ".kt", ".java", ".rb", ".css", ".sh", ".sql", ".ipynb",
]);
const MEDIA_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".mov", ".mp3", ".wav"]);
const PER_FILE = 6000;
const BUDGET = 40000;

export const POST_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short post title, under 60 chars" },
    kind: { type: "string", description: "One or two words: Experiment, Research, Prototype, Tool, Simulation, Study..." },
    hook: { type: "string", description: "Scroll-stopping first line, under 90 chars" },
    caption: { type: "string", description: "Instagram caption, 2 to 4 sentences, plain language, what it is and why it matters" },
    tags: { type: "array", items: { type: "string" }, description: "3 to 6 lowercase hashtags without #" },
    accent: { type: "string", description: "Hex color that fits the subject, e.g. #83d63a" },
    slides: {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["cover", "point", "stat", "list", "quote"] },
          heading: { type: "string", description: "Under 50 chars" },
          body: { type: "string", description: "Under 220 chars" },
          stat: { type: "string", description: "For stat slides: the number or short figure" },
          bullets: { type: "array", items: { type: "string" }, maxItems: 5 },
        },
        required: ["type", "heading"],
      },
    },
  },
  required: ["title", "kind", "hook", "caption", "tags", "accent", "slides"],
};

export const PROMPT = `You turn research notes into one Instagram-style carousel post.
Read the material below (it may be docs, data, code, or a mix) and write a post that teaches
what this work is, the key insight or finding, how it works, and what is interesting about it.
Use only facts in the material. First slide must be type "cover" (heading = the hook).
Last slide should be a takeaway. Keep every text short enough to read on a phone.
Never use em dashes or en dashes.`;

const slugify = (value) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "post";

function rank(rel) {
  const base = path.basename(rel).toLowerCase();
  const ext = path.extname(base);
  const depth = rel.split(path.sep).length;
  if (base.startsWith("readme")) return 0 + depth;
  if (base === "claude.md" || base === "agents.md") return 30 + depth;
  if (DOC_EXT.has(ext) || ext === ".pdf") return 10 + depth;
  if (base === "package.json" || base === "pyproject.toml") return 15;
  if (MARKUP_EXT.has(ext) || DATA_EXT.has(ext)) return 40 + depth;
  return 60 + depth;
}

async function walk(root, dir = root, depth = 0, out = []) {
  if (depth > 4 || out.length > 2000) return out;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".xo") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await walk(root, full, depth + 1, out);
    } else if (entry.isFile()) out.push(path.relative(root, full));
  }
  return out;
}

async function readAny(file) {
  const ext = path.extname(file).toLowerCase();
  const stat = await fs.stat(file);
  if (ext === ".pdf") {
    try {
      const { stdout } = await run("pdftotext", ["-l", "8", file, "-"], { maxBuffer: 8 << 20 });
      return stdout;
    } catch {
      return "";
    }
  }
  if (stat.size > 2 << 20) return "";
  let text = await fs.readFile(file, "utf8");
  if (text.includes("\u0000")) return "";
  if (ext === ".ipynb") {
    try {
      text = JSON.parse(text).cells.map((cell) => [].concat(cell.source).join("")).join("\n\n");
    } catch {}
  }
  if (MARKUP_EXT.has(ext))
    text = text
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
  return text;
}

/** Gather the readable material of a folder (or single file) into one text block. */
export async function collect(target) {
  const stat = await fs.stat(target);
  const root = stat.isDirectory() ? target : path.dirname(target);
  const files = stat.isDirectory() ? await walk(root) : [path.basename(target)];
  const media = files.filter((f) => MEDIA_EXT.has(path.extname(f).toLowerCase()));
  const readable = files
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      if (ext === ".json" && !/package\.json$|manifest|data/i.test(f)) return false;
      if (/lock|\.min\./i.test(f)) return false;
      return DOC_EXT.has(ext) || DATA_EXT.has(ext) || MARKUP_EXT.has(ext) || CODE_EXT.has(ext) || ext === ".pdf";
    })
    .sort((a, b) => rank(a) - rank(b));
  let material = "";
  const used = [];
  for (const rel of readable) {
    if (material.length >= BUDGET) break;
    const text = (await readAny(path.join(root, rel)).catch(() => "")).trim();
    if (!text) continue;
    const chunk = text.slice(0, Math.min(PER_FILE, BUDGET - material.length));
    material += `\n\n===== ${rel} =====\n${chunk}`;
    used.push(rel);
  }
  if (media.length) material += `\n\n===== media files =====\n${media.slice(0, 40).join("\n")}`;
  return { root, name: path.basename(target), files: used, media, material: material.trim() };
}

export const hashOf = (text) => createHash("sha256").update(PROMPT).update(text).digest("hex").slice(0, 16);

async function viaApi(material) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.RESEARCH_MODEL || "claude-sonnet-5-5",
      max_tokens: 4000,
      system: PROMPT,
      tools: [{ name: "post", description: "Return the carousel post", input_schema: POST_SCHEMA }],
      tool_choice: { type: "tool", name: "post" },
      messages: [{ role: "user", content: material }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic API ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.content.find((block) => block.type === "tool_use").input;
}

// When launched from inside Claude Code (desktop app, agents), the parent's
// CLAUDE_* and ANTHROPIC_BASE_URL vars make the child try the host's auth.
function cliEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (key.startsWith("CLAUDE") || key === "ANTHROPIC_BASE_URL") delete env[key];
  return env;
}

function viaCli(material) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["-p", "--output-format", "json", "--model", "sonnet", "--json-schema", JSON.stringify(POST_SCHEMA)],
      { stdio: ["pipe", "pipe", "pipe"], env: cliEnv() },
    );
    let out = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.on("error", reject);
    child.on("close", () => {
      try {
        const result = JSON.parse(out);
        if (result.is_error) return reject(new Error(result.result));
        resolve(result.structured_output ?? JSON.parse(result.result));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(`${PROMPT}\n\n${material}`);
  });
}

/** Ask Claude for a post. Uses ANTHROPIC_API_KEY when set, else the local claude CLI. */
export const generatePost = (material) =>
  process.env.ANTHROPIC_API_KEY ? viaApi(material) : viaCli(material);

/** Collect → (cached) generate → render. Returns a cache record. */
export async function processTarget(target, { force = false, log = console.log } = {}) {
  const info = await collect(target);
  if (info.material.length < 80) {
    log(`skip ${info.name}: nothing readable`);
    return null;
  }
  const slug = slugify(info.name);
  const hash = hashOf(info.material);
  const cacheFile = path.join(CACHE_DIR, `${slug}.json`);
  const cached = await fs.readFile(cacheFile, "utf8").then(JSON.parse).catch(() => null);
  let record = cached;
  if (force || !cached || cached.hash !== hash) {
    log(`generate ${info.name} (${info.files.length} files)`);
    const post = await generatePost(info.material);
    const { mtime } = await fs.stat(target);
    record = { slug, hash, name: info.name, path: target, files: info.files, occurredAt: mtime.toISOString(), post };
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify(record, null, 2));
  } else log(`cached ${info.name}`);
  return record;
}

// ---------- slide rendering ----------

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clean = (s = "") => String(s).replace(/\s*[\u2013\u2014]\s*/g, ", ");

function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const word of clean(text).split(/\s+/).filter(Boolean)) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

function textBlock(text, { x, y, size, max, weight = 400, fill, lineHeight = 1.25, limit = 12 }) {
  const lines = wrap(text, max).slice(0, limit);
  return {
    svg: lines
      .map((l, i) => `<text x="${x}" y="${y + i * size * lineHeight}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(l)}</text>`)
      .join(""),
    bottom: y + lines.length * size * lineHeight,
  };
}

function safeAccent(hex) {
  return /^#[0-9a-f]{6}$/i.test(hex || "") ? hex : "#83d63a";
}

export function renderSlide(post, slide, index, total, name) {
  const W = 1080, H = 1080, P = 96;
  const accent = safeAccent(post.accent);
  const ink = "#f5f6f2", dim = "#b9bdb2";
  let body = "";
  if (slide.type === "cover") {
    body += `<text x="${P}" y="250" font-size="30" font-weight="700" letter-spacing="6" fill="${accent}">${esc(clean(post.kind).toUpperCase())}</text>`;
    const h = textBlock(slide.heading || post.hook, { x: P, y: 360, size: 80, max: 20, weight: 800, fill: ink, lineHeight: 1.1, limit: 4 });
    body += h.svg;
    if (slide.body) body += textBlock(slide.body, { x: P, y: h.bottom + 40, size: 36, max: 44, fill: dim, limit: 4 }).svg;
  } else if (slide.type === "stat") {
    const stat = clean(slide.stat || "").slice(0, 14);
    const statSize = Math.min(190, Math.floor(1500 / Math.max(stat.length, 1)));
    body += `<text x="${P}" y="430" font-size="${statSize}" font-weight="800" fill="${accent}">${esc(stat)}</text>`;
    const h = textBlock(slide.heading, { x: P, y: 560, size: 54, max: 28, weight: 700, fill: ink, limit: 2 });
    body += h.svg;
    if (slide.body) body += textBlock(slide.body, { x: P, y: h.bottom + 26, size: 34, max: 48, fill: dim, limit: 5 }).svg;
  } else if (slide.type === "quote") {
    body += `<text x="${P - 10}" y="360" font-size="240" font-weight="800" fill="${accent}" opacity="0.9">“</text>`;
    const h = textBlock(slide.body || slide.heading, { x: P, y: 440, size: 52, max: 30, weight: 600, fill: ink, lineHeight: 1.2, limit: 7 });
    body += h.svg;
    if (slide.body) body += `<text x="${P}" y="${h.bottom + 60}" font-size="34" fill="${accent}">${esc(clean(slide.heading))}</text>`;
  } else {
    const h = textBlock(slide.heading, { x: P, y: 260, size: 60, max: 26, weight: 800, fill: ink, lineHeight: 1.12, limit: 3 });
    body += `<rect x="${P}" y="170" width="72" height="8" rx="4" fill="${accent}"/>` + h.svg;
    let y = h.bottom + 50;
    if (slide.body) {
      const b = textBlock(slide.body, { x: P, y, size: 36, max: 46, fill: dim, limit: 6 });
      body += b.svg;
      y = b.bottom + 40;
    }
    for (const bullet of (slide.bullets || []).slice(0, 5)) {
      if (y > H - 110) break;
      body += `<circle cx="${P + 10}" cy="${y - 12}" r="9" fill="${accent}"/>`;
      const b = textBlock(bullet, { x: P + 44, y, size: 34, max: 44, fill: ink, limit: 2 });
      body += b.svg;
      y = b.bottom + 26;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif">
<defs><radialGradient id="g" cx="85%" cy="5%" r="90%"><stop offset="0" stop-color="${accent}" stop-opacity="0.38"/><stop offset="0.55" stop-color="${accent}" stop-opacity="0.06"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="#0d0f0c"/><rect width="${W}" height="${H}" fill="url(#g)"/>
<text x="${P}" y="110" font-size="28" font-weight="600" fill="#ffffff" opacity="0.55">${esc(clean(name).replace(/\.[a-z0-9]+$/i, ""))}</text>
${body}</svg>`;
}

function avatarSvg(name, accent) {
  const letters = name.replace(/[^a-z0-9]/gi, " ").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "R";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="#14170f"/><circle cx="80" cy="80" r="70" fill="${accent}" opacity="0.22"/><text x="80" y="98" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="56" font-weight="800" fill="${accent}">${letters}</text></svg>`;
}

function relativeTime(iso, now) {
  const minutes = Math.max(1, Math.round((now - new Date(iso)) / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  if (minutes < 10080) return `${Math.round(minutes / 1440)}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Render slide SVGs for every record and return an Instants seed. */
export async function buildSeed(records, { workspaceName = "Research" } = {}) {
  await fs.mkdir(SLIDE_DIR, { recursive: true });
  const now = Date.now();
  const users = [];
  const posts = [];
  for (const record of records) {
    const { post, slug, name } = record;
    const accent = safeAccent(post.accent);
    const slides = post.slides.length ? post.slides : [{ type: "cover", heading: post.hook }];
    const images = [];
    for (const [i, slide] of slides.entries()) {
      const file = `${slug}-${record.hash.slice(0, 6)}-${i + 1}.svg`;
      await fs.writeFile(path.join(SLIDE_DIR, file), renderSlide(post, slide, i, slides.length, name));
      images.push(`/research/${file}`);
    }
    await fs.writeFile(path.join(SLIDE_DIR, `avatar-${slug}.svg`), avatarSvg(name, accent));
    users.push({
      id: `r-${slug}`,
      username: slug,
      name,
      avatar: `/research/avatar-${slug}.svg`,
      verified: false,
      following: true,
      companyId: "research",
      role: clean(post.kind),
    });
    posts.push({
      id: `research:${slug}`,
      userId: `r-${slug}`,
      companyId: "research",
      workType: clean(post.kind),
      location: record.path ? path.basename(path.dirname(record.path)) + "/" + name : name,
      time: relativeTime(record.occurredAt, now),
      images,
      alt: clean(post.title),
      caption: clean(`${post.hook} ${post.caption}`),
      body: slides.map((s) => clean([s.heading, s.stat, s.body, ...(s.bullets || [])].filter(Boolean).join("\n"))).join("\n\n"),
      tags: post.tags.map((t) => `#${t.replace(/^#/, "").replace(/\s+/g, "-")}`).join(" "),
      likes: 0,
      commentCount: 0,
      comments: [],
      source: { id: "research-folders", label: "Research", nativeId: slug, readOnly: false },
      occurredAt: record.occurredAt,
    });
  }
  posts.sort((a, b) => (b.occurredAt || "").localeCompare(a.occurredAt || ""));
  return {
    sources: [{ id: "research-folders", label: "Research", provider: "folders", readOnly: false, status: "ready", description: "Posts generated from local research folders", updatedAt: new Date(now).toISOString() }],
    companies: [{ id: "research", name: workspaceName, handle: "research", description: "Everything you have researched, as posts.", color: "#83d63a", initials: "R" }],
    currentUser: {
      id: "you",
      username: "suraj",
      name: "Suraj",
      avatar: "/research/avatar-you.svg",
      bio: "Research, turned into posts.",
      followers: String(users.length),
      following: users.length,
      companyId: "research",
      companyIds: ["research"],
      role: "Researcher",
    },
    users,
    posts,
    attention: [],
    messages: [],
    explore: posts.slice(0, 30).map((p) => ({ image: p.images[0], alt: p.alt, category: p.workType || "Research", likes: "0" })),
  };
}

export async function writeYouAvatar() {
  await fs.mkdir(SLIDE_DIR, { recursive: true });
  await fs.writeFile(path.join(SLIDE_DIR, "avatar-you.svg"), avatarSvg("Suraj", "#83d63a"));
}

/** Load every cached record (the full research library). */
export async function loadCache() {
  const files = await fs.readdir(CACHE_DIR).catch(() => []);
  const records = [];
  for (const f of files.filter((f) => f.endsWith(".json")))
    records.push(JSON.parse(await fs.readFile(path.join(CACHE_DIR, f), "utf8")));
  return records;
}

/** List candidate research folders under each root (the root's direct children). */
export async function listTargets(roots, { exclude = [] } = {}) {
  const targets = [];
  for (const root of roots) {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name) || exclude.includes(entry.name)) continue;
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) targets.push(full);
      else if (/\.(pdf|md|txt|html)$/i.test(entry.name)) targets.push(full);
    }
  }
  return targets;
}

export async function writeSeed(seed) {
  await fs.mkdir(path.dirname(SEED_FILE), { recursive: true });
  await fs.writeFile(SEED_FILE, JSON.stringify(seed, null, 2));
}

/** Map with limited concurrency. */
export async function pool(items, size, fn) {
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i).catch((error) => ({ error: String(error.message || error), item: items[i] }));
    }
  }));
  return results;
}
