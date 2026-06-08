import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { isGitRepo, listBranches } from "@/lib/gitLog";
import { SAMPLE_BRANCHES } from "@/lib/sampleData";
import { BranchPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolvePath(raw: string): string {
  return raw.startsWith("~/") ? resolve(homedir(), raw.slice(2)) : resolve(raw);
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("repo")?.trim();

  if (!raw) {
    const payload: BranchPayload = {
      repo: "sample",
      source: "sample",
      branches: SAMPLE_BRANCHES,
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
    const branches = await listBranches(dir);
    const payload: BranchPayload = { repo: dir, source: "git", branches };
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: `git branch failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
