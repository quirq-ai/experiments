import type { CityMap, Target, Touch, TraceEvent } from "../types";
import { touchRank, type FilePlayback } from "./reducer";

// One world, many walkers. The constellation's unified layout renders every
// session's fold on a single shared map, so the scene needs one FilePlayback
// that is the union of all of them: touches keep the deepest state, visits
// add up, and the trail braids everyone's latest moves in wall-clock order —
// the firefly becomes the workspace's combined footstep, not one session's.

export interface Walker {
  events: TraceEvent[];
  seq: number;
}

const RECENT_WINDOW = 12;

export function mergePlaybacks(
  snapshots: FilePlayback[],
  walkers: Walker[],
  city: CityMap | undefined
): FilePlayback {
  const touchByFile = new Map<number, Touch>();
  const touchByPath = new Map<string, Touch>();
  const visitsByFile = new Map<number, number>();
  const historyByPath = new Map<string, TraceEvent[]>();
  for (const snapshot of snapshots) {
    for (const [id, touch] of snapshot.touchByFile) {
      const prev = touchByFile.get(id);
      if (!prev || touchRank[touch] > touchRank[prev]) touchByFile.set(id, touch);
    }
    for (const [path, touch] of snapshot.touchByPath) {
      const prev = touchByPath.get(path);
      if (!prev || touchRank[touch] > touchRank[prev]) touchByPath.set(path, touch);
    }
    for (const [id, n] of snapshot.visitsByFile) {
      visitsByFile.set(id, (visitsByFile.get(id) ?? 0) + n);
    }
    // per-path histories concatenate per lane; the one-world view has no
    // inspector, so cross-lane event order inside a path is not load-bearing
    for (const [path, history] of snapshot.historyByPath) {
      const merged = historyByPath.get(path);
      if (merged) merged.push(...history);
      else historyByPath.set(path, [...history]);
    }
  }

  const idByPath = new Map<string, number>();
  for (const file of city?.files ?? []) idByPath.set(file.path, file.id);
  const recent: { t: number; target: Target }[] = [];
  for (const walker of walkers) {
    // a walker at seq -1 has not started; the loop body never runs
    const from = Math.max(0, walker.seq - RECENT_WINDOW * 2);
    for (let i = from; i <= walker.seq && i < walker.events.length; i++) {
      const event = walker.events[i];
      if (event.targets.length === 0) continue;
      const primary = event.targets.find((target) => !target.weak) ?? event.targets[0];
      const t = Date.parse(event.ts ?? "");
      recent.push({
        t: Number.isNaN(t) ? 0 : t,
        target: { ...primary, fileId: primary.fileId ?? idByPath.get(primary.path) }
      });
    }
  }
  recent.sort((a, b) => a.t - b.t);
  const recentTargets = recent.slice(-RECENT_WINDOW).map((r) => r.target);

  return { touchByFile, touchByPath, visitsByFile, historyByPath, recentTargets };
}
