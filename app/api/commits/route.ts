import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { isGitRepo, readGitLog } from "@/lib/gitLog";
import { sampleCommits } from "@/lib/sampleData";
import { CommitPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolvePath(raw: string): string {
  return raw.startsWith("~/") ? resolve(homedir(), raw.slice(2)) : resolve(raw);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const raw = sp.get("repo")?.trim();
  const branch = sp.get("branch")?.trim() || "main";
  // Lazy, HEAD-anchored windows: skip past commits already loaded, take `limit`
  // more going back. Default to a large window so an explicit non-paged GET
  // still returns full history.
  const skip = Math.max(0, parseInt(sp.get("skip") ?? "0", 10) || 0);
  const limit = Math.max(
    1,
    Math.min(5000, parseInt(sp.get("limit") ?? "", 10) || 4000),
  );

  if (!raw) {
    // Sample history is a fixed ascending array; mirror git's HEAD-back paging
    // by taking the window that ends `skip` commits before HEAD (the end).
    const all = sampleCommits(branch);
    const start = Math.max(0, all.length - skip - limit);
    const end = Math.max(start, all.length - skip);
    const commits = all.slice(start, end);
    const payload: CommitPayload = {
      repo: "sample",
      branch,
      source: "sample",
      commits,
      skip,
      limit,
      hasMore: start > 0,
    };
    return NextResponse.json(payload);
  }

  const dir = resolvePath(raw);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return NextResponse.json({ error: `Not a folder: ${dir}` }, { status: 400 });
  }
  if (!isGitRepo(dir)) {
    return NextResponse.json(
      { error: `No .git found in: ${dir}` },
      { status: 400 },
    );
  }

  try {
    const commits = await readGitLog(dir, branch, { skip, limit });
    const payload: CommitPayload = {
      repo: dir,
      branch,
      source: "git",
      commits,
      skip,
      limit,
      // A full window means there is (almost certainly) older history; a short
      // one means we hit the root. Avoids an extra count over huge repos.
      hasMore: commits.length === limit,
    };
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: `git log failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
