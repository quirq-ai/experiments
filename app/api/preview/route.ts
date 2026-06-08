import { NextRequest, NextResponse } from "next/server";
import { execFile, spawn } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { isGitRepo } from "@/lib/gitLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const run = promisify(execFile);

interface Preview {
  pid: number;
  port: number;
  worktree?: string; // unset when running the repo in-place ("current state")
  repo: string;
  url: string;
  hash: string;
}

const g = globalThis as unknown as { __xoPreviews?: Map<string, Preview> };
const previews: Map<string, Preview> = (g.__xoPreviews ??= new Map());

function resolvePath(raw: string): string {
  return raw.startsWith("~/") ? resolve(homedir(), raw.slice(2)) : resolve(raw);
}

function detectPm(dir: string): "pnpm" | "yarn" | "bun" | "npm" {
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(dir, "yarn.lock"))) return "yarn";
  if (existsSync(join(dir, "bun.lockb"))) return "bun";
  return "npm";
}

function installArgs(pm: string): string[] {
  if (pm === "npm") return ["install", "--no-audit", "--no-fund"];
  if (pm === "yarn") return ["install"];
  if (pm === "bun") return ["install"];
  return ["install", "--prefer-offline"]; // pnpm
}

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", rej);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => res(port));
    });
  });
}

function httpOk(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: "/", timeout: 2500 },
      (r) => {
        r.resume();
        resolve(true);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function teardown(p: Preview) {
  try {
    process.kill(-p.pid, "SIGTERM");
  } catch {
    /* group may already be gone */
  }
  // Only remove a throwaway worktree. A "current state" run has no worktree
  // (it runs in the repo itself), so there is nothing to remove.
  if (p.worktree) {
    try {
      await run("git", [
        "-C",
        p.repo,
        "worktree",
        "remove",
        "--force",
        p.worktree,
      ]);
    } catch {
      /* best effort */
    }
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    repo?: string;
    hash?: string;
    install?: boolean;
    current?: boolean;
  };
  const raw = body.repo?.trim();
  const hash = body.hash?.trim();
  const install = body.install === true;
  const current = body.current === true;

  if (!raw) {
    return NextResponse.json(
      { error: "Live preview needs a real repository." },
      { status: 400 },
    );
  }
  // A commit hash is required to check out a past commit, but not for "current"
  // (which runs the repo's live working tree as-is).
  if (!current && (!hash || !/^[0-9a-fA-F]{4,40}$/.test(hash))) {
    return NextResponse.json({ error: "Invalid commit hash" }, { status: 400 });
  }

  const repo = resolvePath(raw);
  if (!existsSync(repo) || !statSync(repo).isDirectory() || !isGitRepo(repo)) {
    return NextResponse.json({ error: `Not a git repo: ${repo}` }, { status: 400 });
  }

  const pkgPath = join(repo, "package.json");
  if (!existsSync(pkgPath)) {
    return NextResponse.json(
      { error: "No package.json at the repo root, cannot run a dev server." },
      { status: 400 },
    );
  }
  let scripts: Record<string, string> = {};
  try {
    scripts = JSON.parse(readFileSync(pkgPath, "utf8")).scripts ?? {};
  } catch {
    scripts = {};
  }
  const script = scripts.dev ? "dev" : scripts.start ? "start" : null;
  if (!script) {
    return NextResponse.json(
      { error: 'No "dev" or "start" script in package.json.' },
      { status: 400 },
    );
  }

  const pm = detectPm(repo);
  const port = await freePort();

  // Where the dev server runs. "current" runs the repo in-place (its live
  // working tree IS the current state, including uncommitted changes); a commit
  // preview checks the commit out into a throwaway detached worktree so the main
  // tree is never touched.
  let worktree: string | undefined;
  let cwd = repo;

  const cleanupWorktree = () =>
    worktree
      ? run("git", [
          "-C",
          repo,
          "worktree",
          "remove",
          "--force",
          worktree,
        ]).catch(() => {})
      : Promise.resolve();

  if (!current) {
    const wt = join(
      tmpdir(),
      "xo-preview",
      `${(hash as string).slice(0, 8)}-${randomUUID().slice(0, 8)}`,
    );
    worktree = wt;
    cwd = wt;
    try {
      await run("git", [
        "-C",
        repo,
        "worktree",
        "add",
        "--detach",
        wt,
        hash as string,
      ]);
    } catch (e) {
      return NextResponse.json(
        { error: `git worktree failed: ${(e as Error).message}` },
        { status: 500 },
      );
    }

    // Give the worktree a REAL node_modules so the dev server resolves deps
    // without reinstalling. A symlink is rejected by Turbopack, so clone it: on
    // macOS APFS `cp -Rc` is a copy-on-write clone (instant); else plain copy.
    const srcNM = join(repo, "node_modules");
    if (existsSync(srcNM)) {
      const dstNM = join(wt, "node_modules");
      try {
        await run("cp", ["-Rc", srcNM, dstNM]);
      } catch {
        try {
          await run("cp", ["-R", srcNM, dstNM]);
        } catch {
          /* dev server will report missing modules if this fails */
        }
      }
    }
    for (const f of [
      ".env",
      ".env.local",
      ".env.development",
      ".env.development.local",
    ]) {
      const src = join(repo, f);
      const dst = join(wt, f);
      if (existsSync(src) && !existsSync(dst)) {
        try {
          copyFileSync(src, dst);
        } catch {
          /* non-fatal */
        }
      }
    }

    if (install) {
      try {
        await run(pm, installArgs(pm), {
          cwd: wt,
          timeout: 360000,
          maxBuffer: 64 * 1024 * 1024,
          env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
        });
      } catch (e) {
        await cleanupWorktree();
        const msg = (e as Error).message.split("\n").slice(0, 10).join("\n");
        return NextResponse.json(
          { error: "Dependency install failed.", log: msg },
          { status: 500 },
        );
      }
    }
  }

  const args = ["run", script];
  let child;
  try {
    child = spawn(pm, args, {
      cwd,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PORT: String(port),
        BROWSER: "none",
        NEXT_TELEMETRY_DISABLED: "1",
        FORCE_COLOR: "0",
      },
    });
  } catch (e) {
    await cleanupWorktree();
    return NextResponse.json(
      { error: `Could not launch "${pm} ${args.join(" ")}": ${(e as Error).message}` },
      { status: 500 },
    );
  }

  // Capture output so we can (a) report real errors and (b) detect the port the
  // dev server actually bound to, in case it ignores PORT and picks its own.
  let out = "";
  let detectedPort = port;
  const onData = (buf: Buffer) => {
    out += buf.toString();
    if (out.length > 32000) out = out.slice(-32000);
    const m = out.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)/);
    if (m) detectedPort = parseInt(m[1], 10);
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);

  let exited = false;
  let exitMsg = "";
  child.on("error", (err) => {
    exited = true;
    exitMsg = err.message;
  });
  child.on("exit", (code, signal) => {
    exited = true;
    if (!exitMsg) exitMsg = `dev server exited early (code ${code ?? "?"}${signal ? `, ${signal}` : ""})`;
  });

  const tail = () => out.split("\n").filter(Boolean).slice(-12).join("\n");

  if (!child.pid) {
    await cleanupWorktree();
    return NextResponse.json(
      {
        error: `Could not start "${pm} ${args.join(" ")}". Is ${pm} on PATH?`,
      },
      { status: 500 },
    );
  }

  // Wait until the server answers, the process exits, or we time out (90s).
  const start = Date.now();
  let ready = false;
  while (Date.now() - start < 90000) {
    if (exited) break;
    if (await httpOk(detectedPort)) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 700));
  }

  if (!ready) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* ignore */
    }
    await cleanupWorktree();
    const reason = exited
      ? exitMsg
      : "the dev server did not respond within 90s";
    return NextResponse.json(
      {
        error: `Preview failed: ${reason}.`,
        log: tail(),
      },
      { status: 502 },
    );
  }

  const id = randomUUID();
  const url = `http://localhost:${detectedPort}`;
  previews.set(id, {
    pid: child.pid,
    port: detectedPort,
    worktree,
    repo,
    url,
    hash: hash ?? "current",
  });

  return NextResponse.json({
    id,
    url,
    port: detectedPort,
    command: `${pm} run ${script}`,
    shortHash: current ? "current" : (hash as string).slice(0, 7),
  });
}

// ── Process inspection ──────────────────────────────────────────────────────
// "Show all running processes": the dev servers this tool started (tracked in
// `previews`) plus any other dev server listening on the machine. That makes a
// failed run ("another next dev server is already running") explainable and
// fixable instead of a dead end.

interface DetectedServer {
  pid: number;
  port: number;
  command: string;
  dir?: string; // working dir of the process, if resolvable
  label?: string; // basename(dir), for display
  tracked: boolean; // started by this tool
  self: boolean; // this app's own server (or its parent) — never offer to kill
}

async function pidCwd(pid: number): Promise<string | undefined> {
  try {
    const { stdout } = await run("lsof", [
      "-a",
      "-p",
      String(pid),
      "-d",
      "cwd",
      "-Fn",
    ]);
    const line = stdout.split("\n").find((l) => l.startsWith("n"));
    return line ? line.slice(1) : undefined;
  } catch {
    return undefined;
  }
}

function portOf(parts: string[]): number {
  for (const tok of parts) {
    const m = tok.match(/:(\d+)$/);
    if (m) return parseInt(m[1], 10);
  }
  return NaN;
}

async function detectServers(): Promise<DetectedServer[]> {
  let stdout = "";
  try {
    ({ stdout } = await run("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN"], {
      maxBuffer: 8 * 1024 * 1024,
    }));
  } catch {
    return []; // lsof unavailable (non-macOS/Linux) — degrade gracefully
  }

  const trackedPorts = new Set<number>();
  for (const p of previews.values()) trackedPorts.add(p.port);
  const own = new Set<number>([process.pid]);
  if (typeof process.ppid === "number") own.add(process.ppid);

  const byPid = new Map<number, DetectedServer>();
  for (const line of stdout.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;
    const command = parts[0];
    const pid = parseInt(parts[1], 10);
    if (!Number.isFinite(pid)) continue;
    // dev servers run under a JS runtime; skip browsers, postgres, etc.
    if (!/^(node|bun|deno|next)/i.test(command)) continue;
    const port = portOf(parts);
    if (!Number.isFinite(port)) continue;
    const prev = byPid.get(pid);
    if (prev && prev.port <= port) continue; // keep the lowest port per pid
    byPid.set(pid, {
      pid,
      port,
      command,
      tracked: trackedPorts.has(port),
      self: own.has(pid),
    });
  }

  const servers = [...byPid.values()];
  await Promise.all(
    servers.map(async (s) => {
      const dir = await pidCwd(s.pid);
      if (dir) {
        s.dir = dir;
        s.label = basename(dir);
      }
    }),
  );
  return servers.sort((a, b) => a.port - b.port);
}

export async function GET() {
  const tracked = [...previews.entries()].map(([id, p]) => ({
    id,
    repo: p.repo,
    label: basename(p.repo),
    port: p.port,
    url: p.url,
    hash: p.hash,
    current: p.hash === "current",
  }));
  const servers = await detectServers();
  return NextResponse.json({ tracked, servers });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    all?: boolean;
    pid?: number;
  };

  // Stop every preview this tool started (used when the run panel closes).
  if (body.all) {
    await Promise.all([...previews.values()].map((p) => teardown(p)));
    previews.clear();
    return NextResponse.json({ ok: true, stopped: "all" });
  }

  // Kill an external dev server by pid so a run can clear a conflicting server.
  // Guarded: must be one we actually detected, and never this app's own server.
  if (typeof body.pid === "number") {
    const pid = body.pid;
    if (pid === process.pid || pid === process.ppid) {
      return NextResponse.json(
        { error: "Refusing to stop the visualizer's own server." },
        { status: 400 },
      );
    }
    const hit = (await detectServers()).find((s) => s.pid === pid && !s.self);
    if (!hit) return NextResponse.json({ ok: true }); // gone, or not ours to kill
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already exited */
    }
    for (const [id, p] of previews) if (p.pid === pid) previews.delete(id);
    return NextResponse.json({ ok: true, stopped: pid });
  }

  const id = body.id;
  if (!id || !previews.has(id)) {
    return NextResponse.json({ ok: true });
  }
  const p = previews.get(id)!;
  await teardown(p);
  previews.delete(id);
  return NextResponse.json({ ok: true, stopped: id });
}
