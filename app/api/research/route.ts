import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getLocalWorkspace } from "@/engine/local-workspace.mjs";
import { seedTimeline } from "@/engine/timeline.mjs";
import { isSessionId } from "@/engine/schema.mjs";
import type { SeedData } from "@/lib/data";
import * as pipelineModule from "@/research/pipeline.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pipeline: any = pipelineModule;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const headers = { "Cache-Control": "private, no-store" };
const fail = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status, headers });

function isLocal(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.replace(/:\d+$/, "");
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

function store(profileId: string) {
  const root = path.resolve(
    /* turbopackIgnore: true */ process.env.INSTANTS_DATA_DIR ||
      path.join(process.cwd(), ".instants"),
  );
  return getLocalWorkspace({
    directory: path.join(root, profileId),
    lockDirectory: root,
    profileId,
  });
}

/** Push research records (posts + their authors) into the viewer's timeline. */
async function publish(profileId: string, seed: SeedData) {
  const entries = seedTimeline(
    // No viewer, threads or explore: only the research records themselves.
    {
      ...seed,
      currentUser: undefined,
      attention: [],
      messages: [],
      explore: [],
    } as unknown as SeedData,
    new Date().toISOString(),
    randomUUID,
  );
  await store(profileId).importTimeline(entries);
}

async function refreshSeedFile() {
  const records = await pipeline.loadCache();
  await pipeline.writeYouAvatar();
  const seed = (await pipeline.buildSeed(records)) as SeedData;
  await pipeline.writeSeed(seed);
  return seed;
}

/**
 * POST multipart/form-data: `files` (any format), `text`, `title` → one new post.
 * POST JSON {action:"sync"}: rescan the research folders and refresh every post.
 */
export async function POST(request: NextRequest) {
  if (!isLocal(request)) return fail("Research generation runs locally only.", 403);
  const cookie = request.cookies.get("instants-session")?.value;
  if (!cookie || !isSessionId(cookie)) return fail("Open the feed first.", 409);
  const log: string[] = [];
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.startsWith("application/json")) {
      const body = (await request.json()) as { action?: string };
      if (body?.action !== "sync") return fail("Unknown action.");
      const roots = [path.dirname(process.cwd())];
      const targets = await pipeline.listTargets(roots, {
        exclude: [path.basename(process.cwd()), "archive"],
      });
      const results = await pipeline.pool(targets, 4, (t: string) =>
        pipeline.processTarget(t, { log: (m: string) => log.push(m) }),
      );
      const failed = results.filter((r: { error?: string } | null) => r?.error);
      const seed = await refreshSeedFile();
      await publish(cookie, seed);
      return NextResponse.json(
        { posts: seed.posts.length, failed: failed.length, log, errors: failed.map((f: { error: string }) => f.error).slice(0, 3) },
        { headers },
      );
    }

    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const text = String(form.get("text") || "").trim();
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!text && !files.length) return fail("Add a file or paste some text.");
    const name = title || files[0]?.name.replace(/\.[^.]+$/, "") || text.slice(0, 40);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "upload";
    const dir = path.join(pipeline.CACHE_DIR, "uploads", name.replace(/[/\\]/g, "-"));
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    if (text) await fs.writeFile(path.join(dir, "notes.md"), text);
    for (const file of files)
      await fs.writeFile(
        path.join(dir, path.basename(file.name)),
        Buffer.from(await file.arrayBuffer()),
      );
    const record = await pipeline.processTarget(dir, { force: true, log: (m: string) => log.push(m) });
    if (!record) return fail("Nothing readable in that input.");
    const seed = await refreshSeedFile();
    await publish(cookie, seed);
    return NextResponse.json({ postId: `research:${record.slug ?? slug}`, log }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hint = /authenticate|ENOENT|api/i.test(message)
      ? " Set ANTHROPIC_API_KEY in .env.local or run `claude /login`."
      : "";
    return fail(`Generation failed: ${message}.${hint}`, 502);
  }
}
