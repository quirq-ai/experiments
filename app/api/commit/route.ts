import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { isGitRepo, readCommitDetail } from "@/lib/gitLog";
import { CommitDetailPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolvePath(raw: string): string {
  return raw.startsWith("~/") ? resolve(homedir(), raw.slice(2)) : resolve(raw);
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("repo")?.trim();
  const hash = req.nextUrl.searchParams.get("hash")?.trim();

  if (!hash || !/^[0-9a-fA-F]{4,40}$/.test(hash)) {
    return NextResponse.json({ error: "Invalid commit hash" }, { status: 400 });
  }
  // Sample mode has no repo on disk; the client builds the detail itself.
  if (!raw) {
    return NextResponse.json(
      { error: "No repository loaded" },
      { status: 400 },
    );
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
    const detail = await readCommitDetail(dir, hash);
    const payload: CommitDetailPayload = { detail };
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: `git show failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
