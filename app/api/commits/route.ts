import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { promisify } from "node:util";

import type { Commit } from "@/lib/commits";

// Reads real git history with `git log`, so the visualizer grows from actual
// project data. Runs on the Node runtime (needs child_process) and is never
// cached, since the answer depends on the requested repo path.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const run = promisify(execFile);

const FIELD = ""; // unit separator between commit fields
const HEAD = "@@C@@"; // marks the start of a commit record

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repo = (searchParams.get("repo") || process.cwd()).trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 200, 1), 1000);

  if (!existsSync(repo) || !statSync(repo).isDirectory()) {
    return Response.json({ error: `Not a directory: ${repo}` }, { status: 400 });
  }

  try {
    const pretty = `${HEAD}%H${FIELD}%h${FIELD}%an${FIELD}%aI${FIELD}%s`;
    const { stdout } = await run(
      "git",
      [
        "-C",
        repo,
        "log",
        "--no-merges",
        "--reverse",
        `--max-count=${limit}`,
        "--shortstat",
        `--pretty=format:${pretty}`
      ],
      { maxBuffer: 48 * 1024 * 1024 }
    );

    const commits = parseLog(stdout);
    if (commits.length === 0) {
      return Response.json({ error: "No commits found in this repository." }, { status: 404 });
    }

    return Response.json({ repo, count: commits.length, commits });
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    const message = (err.stderr || err.message || "git log failed").toString().slice(0, 400);
    return Response.json({ error: message }, { status: 500 });
  }
}

function parseLog(stdout: string): Commit[] {
  const commits: Commit[] = [];
  let current: Commit | null = null;

  for (const raw of stdout.split("\n")) {
    const line = raw.trimEnd();

    if (line.startsWith(HEAD)) {
      if (current) commits.push(current);
      const [hash, shortHash, author, date, subject] = line.slice(HEAD.length).split(FIELD);
      current = {
        hash: hash || "",
        shortHash: shortHash || "",
        author: author || "unknown",
        date: date || "",
        subject: subject || "(no message)",
        additions: 0,
        deletions: 0,
        files: 0
      };
    } else if (current && /changed/.test(line)) {
      const files = /(\d+) files? changed/.exec(line);
      const insertions = /(\d+) insertions?\(\+\)/.exec(line);
      const deletions = /(\d+) deletions?\(-\)/.exec(line);
      current.files = files ? Number(files[1]) : 0;
      current.additions = insertions ? Number(insertions[1]) : 0;
      current.deletions = deletions ? Number(deletions[1]) : 0;
    }
  }

  if (current) commits.push(current);
  return commits;
}
