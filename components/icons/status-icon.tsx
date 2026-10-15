import { cn } from "@/lib/utils";
import type { IssueStatus } from "@/lib/types";

/*
  Linear-style 14px status glyphs. Colors come from the status tokens in
  globals.css. Pass className to resize (e.g. "size-4").
*/

const RING = { cx: 7, cy: 7, r: 5.5, strokeWidth: 1.6, fill: "none" } as const;

export function StatusIcon({ status, className }: { status: IssueStatus; className?: string }) {
  const cls = cn("size-3.5 shrink-0", className);
  switch (status) {
    case "backlog":
      return (
        <svg viewBox="0 0 14 14" className={cls} aria-label="Backlog">
          <circle {...RING} stroke="var(--status-backlog)" strokeDasharray="1.8 1.9" />
        </svg>
      );
    case "todo":
      return (
        <svg viewBox="0 0 14 14" className={cls} aria-label="Todo">
          <circle {...RING} stroke="var(--status-todo)" />
        </svg>
      );
    case "in_progress":
      return (
        <svg viewBox="0 0 14 14" className={cls} aria-label="In Progress">
          <circle {...RING} stroke="var(--status-progress)" />
          <path d="M7 3.6 A3.4 3.4 0 0 1 7 10.4 Z" fill="var(--status-progress)" />
        </svg>
      );
    case "in_review":
      return (
        <svg viewBox="0 0 14 14" className={cls} aria-label="In Review">
          <circle {...RING} stroke="var(--status-review)" />
          <path d="M7 7 L7 3.6 A3.4 3.4 0 1 1 3.6 7 Z" fill="var(--status-review)" />
        </svg>
      );
    case "done":
      return (
        <svg viewBox="0 0 14 14" className={cls} aria-label="Done">
          <circle cx="7" cy="7" r="6.2" fill="var(--status-done)" />
          <path
            d="M4.3 7.2 L6.2 9.1 L9.8 5.2"
            stroke="#fff"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "canceled":
      return (
        <svg viewBox="0 0 14 14" className={cls} aria-label="Canceled">
          <circle cx="7" cy="7" r="6.2" fill="var(--status-canceled)" />
          <path
            d="M4.8 4.8 L9.2 9.2 M9.2 4.8 L4.8 9.2"
            stroke="#0f1011"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
