import { folderKeys, sessionFolder } from "./folders";
import type { SessionMeta } from "../types";

/** the predicate inputs: what the rail's list actually filters on */
export interface SessionFilters {
  hideEmpty: boolean;
  harness?: string;
  folder?: string;
}

/** what persists: the filters plus the rail's grouping view preference. One
 *  record, one key, so a filter change can never half-write the pair */
export interface StoredFilters extends SessionFilters {
  groupByFolder: boolean;
}

const STORAGE_KEY = "spacewalk.sessionFilters";

// activeKey keeps an explicitly opened session visible even when it has no
// calls; the harness and folder filters are deliberate user intent, so they
// still apply
export function sessionVisible(session: SessionMeta, filters: SessionFilters, activeKey?: string): boolean {
  if (filters.harness && session.harness !== filters.harness) return false;
  if (filters.folder && sessionFolder(session) !== filters.folder) return false;
  if (filters.hideEmpty && session.eventCount === 0 && session.key !== activeKey) return false;
  return true;
}

// a persisted filter can name a harness or a folder with no sessions this
// scan; treating those as "all" avoids an empty list with no visible control
// to clear it. Both the rail and the scan's selection fallback go through
// this, so the two can never disagree about what is filtered
export function effectiveFilters(sessions: SessionMeta[], filters: SessionFilters): SessionFilters {
  const harnesses = new Set(sessions.map((session) => session.harness));
  const folders = folderKeys(sessions);
  return {
    hideEmpty: filters.hideEmpty,
    harness: filters.harness && harnesses.has(filters.harness) ? filters.harness : undefined,
    folder: filters.folder && folders.has(filters.folder) ? filters.folder : undefined
  };
}

export function loadFilters(): StoredFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredFilters>;
      return {
        hideEmpty: parsed.hideEmpty !== false,
        harness: typeof parsed.harness === "string" ? parsed.harness : undefined,
        // "" would read as a folder named nothing; only a non-empty string is a key
        folder: typeof parsed.folder === "string" && parsed.folder !== "" ? parsed.folder : undefined,
        // opt-in, unlike hideEmpty: a payload written before this feature
        // existed must load as a flat list
        groupByFolder: parsed.groupByFolder === true
      };
    }
  } catch {
    // corrupted storage: fall through to defaults
  }
  return { hideEmpty: true, groupByFolder: false };
}

export function saveFilters(filters: StoredFilters): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // storage unavailable: filters reset on next load
  }
}
