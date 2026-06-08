"use client";

import { ArrowDown, ArrowUp, Circle, GitBranch, Play } from "lucide-react";
import { useVisualizer } from "@/lib/visualizer-store";

/**
 * The repo's current working state: branch + HEAD it's sitting on, whether the
 * tree is dirty, ahead/behind upstream, and a button to run it in place.
 */
export function CurrentState() {
  const state = useVisualizer((s) => s.state);
  const isGit = useVisualizer((s) => s.isGit);
  const openRun = useVisualizer((s) => s.openRun);

  if (!state) return null;
  const changed = state.staged + state.unstaged + state.untracked;

  return (
    <div className="mx-2 mb-2 rounded-lg border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Current state
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] ${
            state.dirty ? "text-[#f0c34a]" : "text-[#5ef38b]"
          }`}
        >
          <Circle className="size-2 fill-current" />
          {state.dirty ? "dirty" : "clean"}
        </span>
      </div>

      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] text-foreground">
        <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{state.branch}</span>
        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-[#c7ccc8]">
          {state.head.shortHash}
        </span>
      </div>
      <p className="mb-2 truncate text-[12px] text-muted-foreground">
        {state.head.subject}
      </p>

      {(state.ahead > 0 || state.behind > 0) && (
        <div className="mb-2 flex gap-3 text-[11px] text-muted-foreground">
          {state.ahead > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <ArrowUp className="size-3" />
              {state.ahead} ahead
            </span>
          )}
          {state.behind > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <ArrowDown className="size-3" />
              {state.behind} behind
            </span>
          )}
        </div>
      )}

      {state.dirty && (
        <div className="mb-2 text-[11px] text-muted-foreground">
          {changed.toLocaleString()} uncommitted{" "}
          <span className="text-[#5ef38b]">
            +{state.workingAdd.toLocaleString()}
          </span>{" "}
          <span className="text-[#ff5d6c]">
            -{state.workingDel.toLocaleString()}
          </span>
        </div>
      )}

      <button
        onClick={openRun}
        disabled={!isGit}
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        <Play className="size-3.5" />
        Run current state
      </button>
      {!isGit && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Load a real repo to run its current state.
        </p>
      )}
    </div>
  );
}
