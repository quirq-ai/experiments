"use client";

import { Maximize2, X } from "lucide-react";
import { Commit } from "@/lib/types";

interface CommitStatsProps {
  commit: Commit;
  index: number;
  total: number;
  onClear: () => void;
  onExpand: () => void;
}

/**
 * Stats for the currently selected commit ("current state"), shown in the left
 * Visualize sidebar while a commit is pinned on the wave.
 */
export function CommitStats({
  commit,
  index,
  total,
  onClear,
  onExpand,
}: CommitStatsProps) {
  const net = commit.add - commit.del;
  return (
    <div className="mx-2 mb-3 rounded-lg border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Current commit
        </span>
        <button
          onClick={onClear}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Clear selection"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <p className="mb-2 text-[13px] leading-snug text-foreground">
        {commit.subject}
      </p>

      <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-[#c7ccc8]">
          {commit.hash}
        </span>
        <span className="truncate">{commit.author}</span>
      </div>
      <div className="mb-3 text-[11px] text-muted-foreground">
        {new Date(commit.ts).toLocaleString()}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Stat label="Added" value={`+${commit.add.toLocaleString()}`} color="#5ef38b" />
        <Stat label="Deleted" value={`-${commit.del.toLocaleString()}`} color="#ff5d6c" />
        <Stat
          label="Net"
          value={`${net >= 0 ? "+" : ""}${net.toLocaleString()}`}
          color={net >= 0 ? "#5ef38b" : "#ff5d6c"}
        />
      </div>

      <button
        onClick={onExpand}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-[12px] text-[#c7ccc8] transition-colors hover:border-primary hover:text-[#9be35a]"
      >
        <Maximize2 className="size-3.5" />
        Expand details
      </button>

      <div className="mt-2 text-[10px] text-muted-foreground">
        commit {index + 1} of {total.toLocaleString()}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-md bg-muted px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="text-[12px] font-medium tabular-nums"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}
