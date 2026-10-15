import "server-only";

import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { APP } from "@/components/activity/shared";
import { appendEvent } from "./activity";
import { getIndex } from "./data";
import { ingestSession } from "./db/ingest";
import { PROJECT_ROOT } from "./project-root";
import { localSourceConfig, readRemoteConfig, readSourceSelection, REMOTE_CACHE_DIR, remoteOutputFile, type SourceSelection } from "./sources";
import { EMPTY_REMOTE, remoteActivityFields, type RemoteConfig } from "./remote-config";

export type SyncResult =
  | { ok: true; pages: number; generatedAt: string; durationMs: number }
  | { ok: false; status: number; error: string };

// Shared across hot reloads and requests, so two tabs cannot run the crawler together.
const G = globalThis as typeof globalThis & { __innernetSourceSync?: { running: boolean } };
const state = (G.__innernetSourceSync ??= { running: false });

export const sourceSyncRunning = (): boolean => state.running;

/** Run the same crawler as `pnpm index`, with this server's configured roots and depth.
 * Calling Node directly also works on Windows, without a shell or a global pnpm.
 * Always replace the index this app serves, even if the shell has INNERNET_OUT set. */
async function runCrawler(script: string, env: Record<string, string>, unset: string[] = []): Promise<void> {
  const cwd = PROJECT_ROOT;
  const requireFromProject = createRequire(path.join(cwd, "package.json"));
  const loader = pathToFileURL(requireFromProject.resolve("tsx")).href;
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
  for (const key of unset) delete childEnv[key];
  await new Promise<void>((resolve, reject) => {
    execFile(
      process.execPath,
      ["--import", loader, path.join(cwd, "scripts", script)],
      { cwd, env: childEnv, windowsHide: true, timeout: 5 * 60_000, maxBuffer: 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (!error) return resolve();
        // The crawler's own last word ("GitHub repository x/y was not found or is not
        // public", the hourly limit) says more than any summary could.
        const said = String(stderr ?? "").trim().split("\n").filter(Boolean).pop()?.slice(0, 300);
        reject(Object.assign(error, { said }));
      },
    );
  });
}

async function rebuild(selection: SourceSelection, remote: RemoteConfig): Promise<void> {
  if (selection.local) {
    const config = localSourceConfig();
    const fs = await import("node:fs");
    if (!config.roots.length || config.roots.some((root) => !fs.existsSync(root) || !fs.statSync(root).isDirectory())) {
      throw new Error("One or more local source folders are missing. Check Local folder configuration in Sources.");
    }
    await runCrawler("build-index.ts", { INNERNET_OUT: path.join(PROJECT_ROOT, "data", "index.json") });
  }
  if (selection.remote) {
    const out = remoteOutputFile(remote);
    if (!out) throw new Error("Remote has no repositories to sync.");
    // The collection names every repository as owner/name; an account set in the shell
    // must not narrow it.
    await runCrawler(
      "build-demo-index.ts",
      { INNERNET_REMOTE_OUT: out, INNERNET_REMOTE_CACHE: REMOTE_CACHE_DIR, INNERNET_GITHUB_REPOSITORIES: JSON.stringify(remote.repositories) },
      ["INNERNET_GITHUB_OWNER"],
    );
  }
}

/** A user-requested rebuild and its outcome belong to the requesting tab's history. */
export async function syncSources(session: string): Promise<SyncResult> {
  if (state.running) return { ok: false, status: 409, error: "Sources are already syncing. Try again once that sync finishes." };
  const started = Date.now();
  const selection = readSourceSelection();
  let remote: RemoteConfig = EMPTY_REMOTE;
  if (selection.remote) {
    try {
      remote = readRemoteConfig();
    } catch {
      return { ok: false, status: 400, error: "The saved repositories could not be read. Fix them in Sources, then save before syncing." };
    }
    if (!remote.repositories.length) return { ok: false, status: 400, error: "Add at least one repository to Remote, then save before syncing." };
  }
  state.running = true;
  const command = [selection.local && "pnpm index", selection.remote && "pnpm index:demo"].filter(Boolean).join(" + ");
  const event = { kind: "sync", title: "Sync sources", command, local: selection.local, remote: selection.remote,
    ...(selection.remote ? remoteActivityFields(remote) : {}) };
  try {
    const logged = appendEvent(session, APP, { ...event, status: "started" });
    if (!logged.ok) return { ok: false, status: logged.status, error: "The sync could not be recorded in activity, so it has not started." };

    let result: SyncResult;
    try {
      await rebuild(selection, remote);
      const { index } = getIndex();
      result = { ok: true, pages: index.meta.counts.pages, generatedAt: index.meta.generatedAt, durationMs: Date.now() - started };
    } catch (error) {
      const timedOut = error instanceof Error && "killed" in error && error.killed;
      result = {
        ok: false,
        status: 500,
        error: timedOut ? "Sync timed out after five minutes. Try again or select fewer sources." : selection.remote
          ? `Sources could not all be synced${error instanceof Error && "said" in error && typeof error.said === "string" && error.said ? `: ${error.said}` : ". Check that the repositories are public and that you are online"}.${selection.local ? " A completed local sync is kept." : ""}`
          : "Sources could not be synced. Check that the configured local folders exist and try again.",
      };
    }

    const outcome = appendEvent(session, APP, {
      ...event,
      status: result.ok ? "completed" : "failed",
      durationMs: Date.now() - started,
      ...(result.ok ? { pages: result.pages, generatedAt: result.generatedAt } : { error: result.error }),
    });
    await ingestSession(session);
    if (!outcome.ok) {
      return { ok: false, status: 500, error: result.ok ? "Sources synced, but the result could not be recorded in activity." : `${result.error} The result could not be recorded in activity.` };
    }
    return result;
  } finally {
    state.running = false;
  }
}
