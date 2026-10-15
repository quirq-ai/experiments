"use client";

import { sessionId } from "@/components/activity/trail";
import { appPath } from "@/lib/base-path";

// The one way Sources talks to its routes: a same-origin JSON POST carrying this tab's
// session, so what it changes lands in the tab's history. Throws the route's own sentence.

export async function post<T>(path: string, body: object): Promise<T> {
  const response = await fetch(appPath(path), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, session: sessionId() }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || (result && typeof result.error === "string")) throw new Error(result?.error ?? "That did not work. Try again.");
  return result as T;
}

export const errorOf = (err: unknown) => (err instanceof Error ? err.message : "That did not work. Try again.");

/** The quiet outline button every page uses (History's Store now, the Guide button). */
export const button =
  "inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 text-[12.5px] text-ink-2 transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line-strong disabled:hover:text-ink-2";

export const fine = "text-[12.5px] leading-[1.55] text-muted";
