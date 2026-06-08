"use client";

import { useVisualizer } from "@/lib/visualizer-store";

/**
 * The centered header label, mirroring xo-swarm's DynamicBreadcrumb: the current
 * branch name plus a compact additions/deletions readout for the loaded history.
 */
export function DynamicBreadcrumb() {
  const branch = useVisualizer((s) => s.branch);
  const commits = useVisualizer((s) => s.commits);

  const totalAdd = commits.reduce((a, c) => a + c.add, 0);
  const totalDel = commits.reduce((a, c) => a + c.del, 0);

  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-sm font-medium text-foreground">{branch}</span>
      <span className="ml-1 flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
        <span className="text-[#5ef38b]">+{totalAdd.toLocaleString()}</span>
        <span className="text-[#ff5d6c]">-{totalDel.toLocaleString()}</span>
      </span>
    </span>
  );
}
