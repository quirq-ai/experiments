import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isSameYear,
  parseISO,
} from "date-fns";
import type { Issue, KeyResult, Objective, Sprint } from "./types";

/*
  Pure helpers shared across features. lib/utils.ts is shadcn-owned (cn only);
  everything else lives here.
*/

/** "Aug 10", or "Aug 10, 2025" when not the current year. */
export function formatDate(iso: string): string {
  const d = parseISO(iso);
  return isSameYear(d, new Date()) ? format(d, "MMM d") : format(d, "MMM d, yyyy");
}

/** "Aug 3 to Aug 14" */
export function formatDateRange(startIso: string, endIso: string): string {
  return `${formatDate(startIso)} to ${formatDate(endIso)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export type SprintState = "upcoming" | "active" | "completed";

export function sprintState(sprint: Sprint, now: Date = new Date()): SprintState {
  const today = format(now, "yyyy-MM-dd");
  if (today < sprint.startDate) return "upcoming";
  if (today > sprint.endDate) return "completed";
  return "active";
}

/** Days from today until the sprint ends, clamped at 0. */
export function sprintDaysLeft(sprint: Sprint, now: Date = new Date()): number {
  return Math.max(0, differenceInCalendarDays(parseISO(sprint.endDate), now));
}

/** "2 hours ago", "3 days ago"; falls back to the date for bad input. */
export function timeAgo(iso: string): string {
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

/**
 * 0 to 100. Done always scores 100. Direction comes from kr.direction
 * (fixed at creation) so a lower-is-better KR that beats its target
 * stays at 100 instead of regressing; the value-pair inference is only
 * a fallback for data created before direction existed. Ratio scoring
 * is approximate for negative-range values (clamped to 0..100).
 */
export function krProgress(kr: KeyResult): number {
  if (kr.status === "done") return 100;
  const direction = kr.direction ?? (kr.target < kr.current ? "decrease" : "increase");
  if (direction === "decrease") {
    if (kr.current <= kr.target) return 100;
    const pct = kr.target / Math.max(kr.current, 0.0001);
    return Math.round(Math.min(1, Math.max(0, pct)) * 100);
  }
  if (kr.current >= kr.target) return 100;
  if (kr.target === 0) return kr.current === 0 ? 100 : 0;
  return Math.round(Math.min(1, Math.max(0, kr.current / kr.target)) * 100);
}

export function objectiveProgress(objective: Objective): number {
  if (objective.keyResults.length === 0) return 0;
  const sum = objective.keyResults.reduce((acc, kr) => acc + krProgress(kr), 0);
  return Math.round(sum / objective.keyResults.length);
}

/** Completed portion of a sprint: done issues over all non-canceled issues. */
export function sprintCompletion(issues: Issue[]): number {
  const scoped = issues.filter((i) => i.status !== "canceled");
  if (scoped.length === 0) return 0;
  const done = scoped.filter((i) => i.status === "done").length;
  return Math.round((done / scoped.length) * 100);
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  return items.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

/** Stable id for locally created entities. */
export function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Deep link into space-walk (Walk) for an agent session replay. The base
 * URL comes from NEXT_PUBLIC_SPACEWALK_URL; the default matches the
 * pinned port convention from the Space convergence plan, that is
 * `spacewalk serve -port 8787`. Walk resolves the selector against the
 * session id or the log file basename.
 */
export function spacewalkSessionUrl(sessionId: string): string {
  const base = (process.env.NEXT_PUBLIC_SPACEWALK_URL ?? "http://127.0.0.1:8787").replace(
    /\/+$/,
    ""
  );
  return `${base}/?session=${encodeURIComponent(sessionId)}`;
}
