"use client";

import { useEffect } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { CommitWave } from "@/components/CommitWave";
import { RunPanel } from "@/components/run-panel";
import { useVisualizer } from "@/lib/visualizer-store";

/**
 * Inset content for the xo-swarm-style shell (see ConditionalLayout): the commit
 * wave stage. When a "current state" run is active, the stage splits in half:
 * the live preview on the left, the wave on the right.
 *
 * History loads lazily, HEAD first. "Load older" (or a left wheel/swipe toward
 * older history) pulls the next Fibonacci-sized batch of older commits.
 */
export default function Home() {
  const loadRepo = useVisualizer((s) => s.loadRepo);
  const commits = useVisualizer((s) => s.commits);
  const branch = useVisualizer((s) => s.branch);
  const replaySignal = useVisualizer((s) => s.replaySignal);
  const selected = useVisualizer((s) => s.selected);
  const selectCommit = useVisualizer((s) => s.selectCommit);
  const error = useVisualizer((s) => s.error);
  const runOpen = useVisualizer((s) => s.runOpen);
  const loadOlder = useVisualizer((s) => s.loadOlder);
  const hasMore = useVisualizer((s) => s.hasMoreHistory);
  const loadingMore = useVisualizer((s) => s.loadingMore);
  const nextBatch = useVisualizer((s) => s.nextBatch);

  // Boot on sample data (no repo) once.
  useEffect(() => {
    loadRepo("");
  }, [loadRepo]);

  // Scrolling/swiping toward older history (left) reveals the next batch.
  const onWheel = (e: React.WheelEvent) => {
    if (!hasMore || loadingMore) return;
    if (e.deltaX < -16 || (e.shiftKey && e.deltaY < -16)) loadOlder();
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1">
      {runOpen && (
        <div className="flex min-h-0 w-1/2 min-w-0 border-r border-border">
          <RunPanel />
        </div>
      )}
      <div className="relative min-h-0 min-w-0 flex-1" onWheel={onWheel}>
        {error && (
          <div className="pointer-events-none absolute bottom-4 left-6 z-10 max-w-[60%] truncate text-[11px] text-[#ff5d6c]">
            {error}
          </div>
        )}

        {hasMore && (
          <button
            onClick={loadOlder}
            disabled={loadingMore}
            title="Fetch the next batch of older commits (Fibonacci)"
            className="absolute left-3 top-1/2 z-20 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-2 text-[12px] text-muted-foreground shadow-lg backdrop-blur transition-colors hover:text-foreground disabled:opacity-60"
          >
            {loadingMore ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ChevronLeft className="size-3.5" />
            )}
            {loadingMore ? "Loading" : `Load ${nextBatch.toLocaleString()} older`}
          </button>
        )}

        <CommitWave
          commits={commits}
          branch={branch}
          replaySignal={replaySignal}
          selectedIndex={selected}
          onSelect={selectCommit}
        />
      </div>
    </section>
  );
}
