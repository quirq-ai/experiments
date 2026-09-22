import type { AgentGraph, CityMap, JudgeChoice, ReportStatus, SessionMeta, Trace } from "../types";

/** a non-OK response with its status kept, so callers can branch on the code —
 * the map-history flow treats 404 ("not a git repo") as a quiet absence, not
 * an error worth a toast */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const detail = (await res.text()).trim();
    throw new ApiError(detail || `${res.status} ${res.statusText}`, res.status);
  }
  return res.json() as Promise<T>;
}

// raw fetch failures read like stack noise in the toast; translate the two
// failure shapes (server gone vs. server said no) into something actionable
export function describeError(err: unknown, doing: string): string {
  if (err instanceof TypeError) {
    return `Can't reach the Space Walk server while ${doing} — is it still running?`;
  }
  const detail = (err instanceof Error ? err.message : String(err)).trim();
  return detail ? `Couldn't finish ${doing}: ${detail}` : `Couldn't finish ${doing}`;
}

export function listSessions(fresh = false): Promise<SessionMeta[]> {
  return getJSON<SessionMeta[]>(fresh ? "/api/sessions?fresh=1" : "/api/sessions");
}

export function getTrace(key: string): Promise<Trace> {
  return getJSON<Trace>(`/api/sessions/${encodeURIComponent(key)}/trace`);
}

export function getCityMap(key: string): Promise<CityMap> {
  return getJSON<CityMap>(`/api/sessions/${encodeURIComponent(key)}/citymap`);
}

export function getSessionSnapshot(key: string): Promise<{ trace: Trace; city: CityMap }> {
  return getJSON<{ trace: Trace; city: CityMap }>(`/api/sessions/${encodeURIComponent(key)}/snapshot`);
}

export function getSessionAgents(rootKey: string): Promise<AgentGraph> {
  return getJSON<AgentGraph>(`/api/sessions/${encodeURIComponent(rootKey)}/agents`);
}

export function getAgentTrace(rootKey: string, agentID: string): Promise<Trace> {
  return getJSON<Trace>(
    `/api/sessions/${encodeURIComponent(rootKey)}/agents/${encodeURIComponent(agentID)}/trace`
  );
}

export function getSessionReport(key: string): Promise<ReportStatus> {
  return getJSON<ReportStatus>(`/api/sessions/${encodeURIComponent(key)}/report`);
}

// kicks off a judge run on the server; progress is observed by polling
// getSessionReport until state leaves "running". The choice picks judge CLI
// and model; omitted fields fall back to the server's defaults.
export async function startSessionAnalyze(key: string, choice?: JudgeChoice): Promise<ReportStatus> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(key)}/analyze`, {
    method: "POST",
    headers: choice ? { "Content-Type": "application/json" } : undefined,
    body: choice ? JSON.stringify(choice) : undefined
  });
  if (!res.ok) {
    const detail = (await res.text()).trim();
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<ReportStatus>;
}

// backs the static full-repo map view: the citymap for a repo, with no session
// or trace attached. Without a repo path the server falls back to its
// configured RepoRoot (the `spacewalk map <repo>` case).
export function getRepoMap(repo?: string): Promise<CityMap> {
  const url = repo ? `/api/repomap?repo=${encodeURIComponent(repo)}` : "/api/repomap";
  return getJSON<CityMap>(url);
}

// the repo's git history synthesized as a Trace — one event per commit,
// chronological, harness "git" — so the map view can reuse the whole playback
// stack unchanged. 404 (an ApiError) means the path is not a git repo.
export function getRepoHistory(repo: string): Promise<Trace> {
  return getJSON<Trace>(`/api/repomap/history?repo=${encodeURIComponent(repo)}`);
}

/** one file's churn in a commit, as git numstat counts it */
export interface CommitFile {
  path: string;
  insertions: number;
  deletions: number;
}

/** one commit in full: numstat rows plus the raw patch text, which the server
 * truncates at 64 KiB with a trailing "… truncated" marker */
export interface CommitDetail {
  hash: string;
  author: string;
  ts: string;
  subject: string;
  files: CommitFile[];
  patch: string;
}

export function getRepoCommit(repo: string, hash: string): Promise<CommitDetail> {
  return getJSON<CommitDetail>(
    `/api/repomap/commit?repo=${encodeURIComponent(repo)}&hash=${encodeURIComponent(hash)}`
  );
}
