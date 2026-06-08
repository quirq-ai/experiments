import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { isGitRepo } from "@/lib/gitLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const run = promisify(execFile);

function resolvePath(raw: string): string {
  return raw.startsWith("~/") ? resolve(homedir(), raw.slice(2)) : resolve(raw);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

async function refExists(repo: string, branch: string): Promise<boolean> {
  try {
    await run("git", [
      "-C",
      repo,
      "rev-parse",
      "--verify",
      "--quiet",
      `refs/heads/${branch}`,
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Resolve claude's absolute path via a login shell (so it matches what a fresh
 *  Terminal would see), falling back to the bare name if it can't be found. */
async function resolveClaude(): Promise<string> {
  try {
    const { stdout } = await run("bash", ["-lc", "command -v claude"]);
    return stdout.trim().split("\n").filter(Boolean).pop() || "claude";
  } catch {
    return "claude";
  }
}

/**
 * Open an interactive Claude Code session in the worktree. On macOS this opens a
 * new Terminal window that cd's into the worktree and runs `claude`, so the user
 * can drive the agent there; its commits land on the experiment branch and show
 * up in the visualizer on the next refresh.
 */
async function launchClaude(
  worktree: string,
): Promise<{ launched: boolean; how: string; error?: string }> {
  if (process.platform !== "darwin") {
    return { launched: false, how: "manual" };
  }
  const bin = await resolveClaude();
  const cmd = `cd ${JSON.stringify(worktree)} && ${JSON.stringify(bin)}`;
  const script = `tell application "Terminal"
  activate
  do script ${JSON.stringify(cmd)}
end tell`;
  try {
    await run("osascript", ["-e", script]);
    return { launched: true, how: "Terminal" };
  } catch (e) {
    return { launched: false, how: "Terminal", error: (e as Error).message };
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    repo?: string;
    name?: string;
    base?: string;
    launch?: boolean;
  };
  const raw = body.repo?.trim();
  const launch = body.launch !== false; // default: launch the session
  if (!raw) {
    return NextResponse.json(
      { error: "An experiment needs a real repository." },
      { status: 400 },
    );
  }
  const repo = resolvePath(raw);
  if (!existsSync(repo) || !statSync(repo).isDirectory() || !isGitRepo(repo)) {
    return NextResponse.json({ error: `Not a git repo: ${repo}` }, { status: 400 });
  }

  // Base the experiment on the repo's current HEAD by default.
  const base = body.base?.trim() || "HEAD";

  // Name → branch. With no name, auto-number (experiment/1, experiment/2, …) so
  // one click just works; fall back to a random suffix on any collision.
  let slug = body.name ? slugify(body.name) : "";
  if (!slug) {
    let n = 1;
    try {
      const { stdout } = await run("git", [
        "-C",
        repo,
        "for-each-ref",
        "--format=%(refname:short)",
        "refs/heads/experiment",
      ]);
      const nums = stdout
        .split("\n")
        .map((l) => l.match(/^experiment\/(\d+)$/)?.[1])
        .filter(Boolean)
        .map((x) => parseInt(x as string, 10));
      n = (nums.length ? Math.max(...nums) : 0) + 1;
    } catch {
      /* no experiment branches yet */
    }
    slug = String(n);
  }
  let branch = `experiment/${slug}`;
  if (await refExists(repo, branch)) {
    branch = `experiment/${slug}-${randomUUID().slice(0, 4)}`;
  }

  // Worktree under a sibling ".worktrees/<repo>/<branch>" so it lives outside the
  // repo's own tree (a worktree inside the repo confuses tooling and dev builds).
  const wtRoot = join(dirname(repo), ".worktrees", basename(repo));
  const worktree = join(wtRoot, branch.replace(/\//g, "-"));
  try {
    mkdirSync(wtRoot, { recursive: true });
  } catch {
    /* already exists */
  }

  // Create the worktree on a fresh branch …
  try {
    await run("git", [
      "-C",
      repo,
      "worktree",
      "add",
      "-b",
      branch,
      worktree,
      base,
    ]);
  } catch (e) {
    return NextResponse.json(
      { error: `git worktree add failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  // … then one empty commit so the branch has its own tip and shows up in the
  // branch list right away (before the Claude session does any work).
  try {
    await run("git", [
      "-C",
      worktree,
      "commit",
      "--allow-empty",
      "-m",
      `experiment: ${body.name || slug} (start)`,
    ]);
  } catch (e) {
    // Roll back so a failed commit never leaves a half-made experiment behind.
    await run("git", ["-C", repo, "worktree", "remove", "--force", worktree]).catch(
      () => {},
    );
    await run("git", ["-C", repo, "branch", "-D", branch]).catch(() => {});
    return NextResponse.json(
      {
        error: `git commit failed: ${(e as Error).message}. Set git user.name/user.email, then retry.`,
      },
      { status: 500 },
    );
  }

  const claude = launch
    ? await launchClaude(worktree)
    : { launched: false, how: "skipped" };

  return NextResponse.json({ branch, worktree, slug, base, claude });
}
