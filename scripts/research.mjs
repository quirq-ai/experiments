#!/usr/bin/env node
// Turn local research folders into posts.
//   node scripts/research.mjs [roots...]          generate (cached) + write data/research.json
//   node scripts/research.mjs --force [roots...]  regenerate everything
//   node scripts/research.mjs --prepare <dir>     dump collected material per folder (for offline generation)
//   node scripts/research.mjs --adopt <dir>       read <slug>.post.json files from <dir> into the cache
//   node scripts/research.mjs --seed              rebuild data/research.json from the cache only
import fs from "node:fs/promises";
import path from "node:path";
import {
  CACHE_DIR, buildSeed, collect, hashOf, listTargets, loadCache, pool,
  processTarget, writeSeed, writeYouAvatar,
} from "../research/pipeline.mjs";

const APP = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const value = args[i + 1];
  args.splice(i, 2);
  return value ?? true;
};
const force = args.includes("--force") && args.splice(args.indexOf("--force"), 1);
const prepare = flag("--prepare");
const adopt = flag("--adopt");
const seedOnly = args.includes("--seed") && args.splice(args.indexOf("--seed"), 1);
// Default roots: the folder this app lives in (its sibling experiments).
const roots = (args.length ? args : [path.dirname(APP)]).map((r) => path.resolve(r));
const slugify = (v) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "post";

async function seed() {
  const records = await loadCache();
  await writeYouAvatar();
  await writeSeed(await buildSeed(records));
  console.log(`wrote data/research.json with ${records.length} posts`);
}

if (prepare) {
  await fs.mkdir(prepare, { recursive: true });
  const targets = await listTargets(roots, { exclude: [path.basename(APP), "archive"] });
  const manifest = [];
  for (const target of targets) {
    const info = await collect(target);
    if (info.material.length < 80) continue;
    const slug = slugify(info.name);
    const { mtime } = await fs.stat(target);
    await fs.writeFile(path.join(prepare, `${slug}.material.txt`), info.material);
    manifest.push({ slug, hash: hashOf(info.material), name: info.name, path: target, files: info.files, occurredAt: mtime.toISOString() });
  }
  await fs.writeFile(path.join(prepare, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`prepared ${manifest.length} folders in ${prepare}`);
} else if (adopt) {
  const manifest = JSON.parse(await fs.readFile(path.join(adopt, "manifest.json"), "utf8"));
  await fs.mkdir(CACHE_DIR, { recursive: true });
  let count = 0;
  for (const entry of manifest) {
    const post = await fs.readFile(path.join(adopt, `${entry.slug}.post.json`), "utf8").then(JSON.parse).catch(() => null);
    if (!post) continue;
    await fs.writeFile(path.join(CACHE_DIR, `${entry.slug}.json`), JSON.stringify({ ...entry, post }, null, 2));
    count++;
  }
  console.log(`adopted ${count} posts`);
  await seed();
} else if (seedOnly) {
  await seed();
} else {
  const targets = await listTargets(roots, { exclude: [path.basename(APP), "archive"] });
  const results = await pool(targets, 4, (t) => processTarget(t, { force }));
  for (const r of results.filter((r) => r?.error)) console.error(`failed ${r.item}: ${r.error}`);
  await seed();
}
