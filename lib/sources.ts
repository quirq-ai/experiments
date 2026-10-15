import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { PROJECT_ROOT } from "./project-root";
import { EMPTY_REMOTE, normalizeRemoteConfig, type RemoteConfig } from "./remote-config";

export interface SourceSelection { local: boolean; remote: boolean }

export const SOURCE_SETTINGS_FILE = path.join(PROJECT_ROOT, "data", "sources.json");
export const LOCAL_INDEX_FILE = path.join(PROJECT_ROOT, "data", "index.json");
export const BUNDLED_REMOTE_INDEX_FILE = path.join(PROJECT_ROOT, "data", "demo", "index.json");
export const SOURCE_CONFIG_FILE = path.join(PROJECT_ROOT, "innernet.config.json");
export const REMOTE_CACHE_DIR = path.join(PROJECT_ROOT, ".github-cache");

export function validSourceSelection(value: unknown): value is SourceSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as SourceSelection;
  return typeof s.local === "boolean" && typeof s.remote === "boolean" && (s.local || s.remote);
}

export function readSourceSelection(): SourceSelection {
  try {
    const saved: unknown = JSON.parse(fs.readFileSync(SOURCE_SETTINGS_FILE, "utf8"));
    if (validSourceSelection(saved)) return { local: saved.local, remote: saved.remote };
  } catch {
    // Existing installations begin with their local folders.
  }
  return { local: true, remote: false };
}

export function readRemoteConfig(): RemoteConfig {
  let saved: Record<string, unknown>;
  try {
    saved = JSON.parse(fs.readFileSync(SOURCE_SETTINGS_FILE, "utf8"));
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
      throw new Error("Saved source settings could not be read. Fix the repositories in Sources and save again.");
    }
    return { ...EMPTY_REMOTE, repositories: [] };
  }
  if (saved && Object.hasOwn(saved, "remoteConfig")) return normalizeRemoteConfig(saved.remoteConfig);
  return { ...EMPTY_REMOTE, repositories: [] };
}

export function writeSourceSelection(selection: SourceSelection, remote = readRemoteConfig()): void {
  if (!validSourceSelection(selection)) throw new Error("Choose at least one source.");
  fs.mkdirSync(path.dirname(SOURCE_SETTINGS_FILE), { recursive: true });
  const temporary = `${SOURCE_SETTINGS_FILE}.${process.pid}.tmp`;
  const { repositories } = normalizeRemoteConfig({ repositories: remote.repositories });
  fs.writeFileSync(temporary, JSON.stringify({ local: selection.local, remote: selection.remote, remoteConfig: { repositories } }, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(temporary, SOURCE_SETTINGS_FILE);
}

export function localSourceConfig(): { roots: string[]; maxDepth: number } {
  const config = JSON.parse(fs.readFileSync(SOURCE_CONFIG_FILE, "utf8")) as { roots: string[]; maxDepth: number };
  const rootSpecs = process.env.INNERNET_ROOTS?.split(",") ?? config?.roots;
  const maxDepth = Number(process.env.INNERNET_MAX_DEPTH ?? config?.maxDepth ?? 6);
  if (!Array.isArray(rootSpecs) || rootSpecs.some((root) => typeof root !== "string") || !Number.isInteger(maxDepth) || maxDepth < 0) {
    throw new Error("Local folder configuration needs a roots array and a non-negative whole-number maxDepth.");
  }
  const roots = rootSpecs
    .map((root) => root.trim()).filter(Boolean)
    .map((root) => path.resolve(PROJECT_ROOT, root.replace(/^~(?=$|[\\/])/, os.homedir())));
  return { roots, maxDepth };
}

/** The snapshot of one collection of repositories. Each distinct list has its own, so a
 * changed list never shows another list's pages. Null for an empty list. */
export function remoteOutputFile(remote = readRemoteConfig()): string | null {
  if (!remote.repositories.length) return null;
  const key = createHash("sha256").update(JSON.stringify(remote.repositories)).digest("hex").slice(0, 20);
  return path.join(PROJECT_ROOT, "data", `github-${key}.json`);
}

/** The snapshot the app reads for the saved collection: the same file, synced or not yet. */
export function remoteIndexFile(remote = readRemoteConfig()): string | null {
  return remoteOutputFile(remote);
}
