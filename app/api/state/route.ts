import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { isGitRepo, readRepoState } from "@/lib/gitLog";
import { sampleState } from "@/lib/sampleData";
import { RepoStatePayload } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolvePath(raw: string): string {
  return raw.startsWith("~/") ? resolve(homedir(), raw.slice(2)) : resolve(raw);
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("repo")?.trim();

  if (!raw) {
    const payload: RepoStatePayload = { state: sampleState() };
    return NextResponse.json(payload);
  }

  const dir = resolvePath(raw);
  if (!existsSync(dir) || !statSync(dir).isDirectory() || !isGitRepo(dir)) {
    return NextResponse.json({ error: `Not a git repo: ${dir}` }, { status: 400 });
  }

  try {
    const state = await readRepoState(dir);
    const payload: RepoStatePayload = { state };
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: `git state failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
