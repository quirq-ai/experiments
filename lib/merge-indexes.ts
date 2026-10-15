import type { Page, SiteIndex } from "./types";

/** Combine the chosen indexes without changing either source on disk or in memory.
 * GitHub URLs have their own namespace even when Local is unchecked, so ordinary
 * source switches keep bookmarked GitHub articles pointing at the same page. */
export function mergeIndexes(local: SiteIndex | null, remote: SiteIndex | null): SiteIndex {
  const pages = [...(local?.pages ?? [])];
  const disambiguation: SiteIndex["disambiguation"] = Object.fromEntries(
    Object.entries(local?.disambiguation ?? {}).map(([key, entry]) => [key, { ...entry, slugs: [...entry.slugs] }]),
  );

  if (remote) {
    // Reserve both article and list routes, case-insensitively like resolveSlug.
    const taken = new Set([
      ...pages.map((p) => p.slug.toLowerCase()),
      ...Object.keys(disambiguation).flatMap((key) => [key.toLowerCase(), `${key}_(disambiguation)`.toLowerCase()]),
    ]);
    const mapped = new Map<string, string>();
    const names = new Set([...remote.pages.map((p) => p.slug), ...Object.keys(remote.disambiguation)]);
    for (const name of names) {
      if (mapped.has(name.toLowerCase())) continue;
      const base = `github:${name}`;
      let slug = base;
      let suffix = 2;
      while (taken.has(slug.toLowerCase()) || taken.has(`${slug}_(disambiguation)`.toLowerCase())) slug = `${base}_${suffix++}`;
      mapped.set(name.toLowerCase(), slug);
      taken.add(slug.toLowerCase());
      if (remote.disambiguation[name]) taken.add(`${slug}_(disambiguation)`.toLowerCase());
    }
    const map = (slug: string) => mapped.get(slug.toLowerCase()) ?? `github:${slug}`;
    pages.push(...remote.pages.map((p) => ({
      ...p,
      slug: map(p.slug),
      parent: p.parent === null ? null : map(p.parent),
      partOf: p.partOf === null ? null : map(p.partOf),
      children: p.children.map(map),
      related: p.related.map(map),
    })));
    for (const [key, entry] of Object.entries(remote.disambiguation)) {
      disambiguation[map(key)] = { primary: entry.primary === null ? null : map(entry.primary), slugs: entry.slugs.map(map) };
    }
  }

  // A name shared across sources gets one combined list as well as its source's
  // existing list. Keep the local article's bare URL and primary-topic behavior.
  const byName = new Map<string, Page[]>();
  const localSlugs = new Set(local?.pages.map((p) => p.slug) ?? []);
  for (const page of pages) {
    const key = page.name.toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), page]);
  }
  for (const group of byName.values()) {
    if (!group.some((p) => localSlugs.has(p.slug)) || !group.some((p) => !localSlugs.has(p.slug))) continue;
    const key = group[0].name.replace(/\s+/g, "_");
    // Category and Special prefixes name built-in routes, never article lists.
    if (/^(?:category|special):/i.test(key)) continue;
    const existingKey = Object.keys(disambiguation).find((k) => k.toLowerCase() === key.toLowerCase()) ?? key;
    const primary = group.find((p) => p.slug.toLowerCase() === existingKey.toLowerCase())?.slug ?? null;
    disambiguation[existingKey] = { primary, slugs: group.map((p) => p.slug) };
  }

  const sources = [local, remote].filter((index): index is SiteIndex => index !== null);
  const roots = sources.flatMap((index) => index.meta.roots);
  const articles = pages.filter((p) => p.isArticle).length;
  const realmBySlug = new Map(pages.map((p) => [p.slug, p.realm]));
  const agents = pages.filter((p) => p.realm === "agent" && (!p.parent || realmBySlug.get(p.parent) !== "agent")).length;
  return {
    meta: {
      generatedAt: sources.map((index) => index.meta.generatedAt).sort().at(-1) ?? "",
      roots: roots.filter((root, i) => roots.findIndex((candidate) => candidate.path === root.path) === i),
      maxDepth: Math.max(0, ...sources.map((index) => index.meta.maxDepth)),
      deeperCounted: sources.some((index) => index.meta.deeperCounted),
      counts: {
        pages: pages.length,
        articles,
        repos: pages.filter((p) => p.kind === "repo").length,
        stubs: pages.length - articles,
        categories: new Set(pages.flatMap((p) => p.categories)).size,
        agents,
      },
      durationMs: sources.reduce((total, index) => total + index.meta.durationMs, 0),
      // A GitHub source is usable in the local application; it is not demo mode.
    },
    pages,
    disambiguation,
  };
}
