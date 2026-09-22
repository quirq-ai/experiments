import type { Action, Trace } from "../types";

// The constellation's shared clock: real wall-clock time t maps onto a
// compressed axis c in [0, cMax] where active bursts keep their true width
// and dead air pinches into uniform seams. Pure module — no imports beyond
// types — so the math stays unit-checkable without a DOM.

/** dt above this is dead air between bursts; buildAxis doubles it until
 * metronomic sessions stop shattering the axis into confetti */
export const GAP_MS = 300_000;
/** one seam never spends more compressed width than this */
export const SEAM_CAP_MS = 45_000;

const MAX_SEGMENTS = 48;
/** seams as a fraction of active width — bounds total seam share at ~20% */
const SEAM_SHARE = 0.25;
/** single-event bursts still get a visible, scrubbable slice */
const MIN_ACTIVE_MS = 1_000;

export interface AxisSegment {
  realStart: number;
  realEnd: number;
  cStart: number;
  cEnd: number;
  kind: "active" | "gap";
}

export interface GlobalAxis {
  segments: AxisSegment[];
  cMax: number;
  tMin: number;
  tMax: number;
}

export interface AxisOptions {
  gapMs?: number;
  maxSegments?: number;
  seamCapMs?: number;
  seamShare?: number;
}

export interface LaneBucket {
  count: number;
  dominant: Action;
}

// wall-clock per event, index == seq. TraceEvent.ts is optional and logs can
// carry junk: an unparseable ts inherits the previous time, a running max
// keeps the array monotone (so binary search always agrees with seq order),
// and the first valid time back-fills the head. A trace with no usable ts at
// all stays NaN throughout — seqAt reads that lane as never started.
export function laneTimes(trace: Trace): Float64Array {
  const events = trace.events;
  const times = new Float64Array(events.length);
  let last = NaN;
  for (let i = 0; i < events.length; i++) {
    const raw = events[i].ts;
    const parsed = raw === undefined ? NaN : Date.parse(raw);
    if (!Number.isNaN(parsed)) last = Number.isNaN(last) ? parsed : Math.max(last, parsed);
    times[i] = last;
  }
  if (times.length > 0 && Number.isNaN(times[0])) {
    let firstValid = NaN;
    for (let i = 0; i < times.length; i++) {
      if (!Number.isNaN(times[i])) {
        firstValid = times[i];
        break;
      }
    }
    for (let i = 0; i < times.length && Number.isNaN(times[i]); i++) times[i] = firstValid;
  }
  return times;
}

// last event at or before t: upperBound - 1. -1 means not started, which
// PlaybackEngine.snapshotAt(-1) already renders as the empty fold. NaN
// entries compare false, so an unclocked lane never starts.
export function seqAt(times: Float64Array, t: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (times[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

export function buildAxis(lanes: Float64Array[], opts?: AxisOptions): GlobalAxis {
  const maxSegments = opts?.maxSegments ?? MAX_SEGMENTS;
  const seamCapMs = opts?.seamCapMs ?? SEAM_CAP_MS;
  const seamShare = opts?.seamShare ?? SEAM_SHARE;

  // one sorted wall-clock of every lane; unclocked (NaN) events contribute nothing
  let total = 0;
  for (const lane of lanes) {
    for (let i = 0; i < lane.length; i++) if (Number.isFinite(lane[i])) total++;
  }
  const merged = new Float64Array(total);
  let n = 0;
  for (const lane of lanes) {
    for (let i = 0; i < lane.length; i++) if (Number.isFinite(lane[i])) merged[n++] = lane[i];
  }
  merged.sort();

  if (total === 0) {
    // no clock anywhere: a 1s stub keeps cMax > 0 so the scrubber stays alive
    return {
      segments: [{ realStart: 0, realEnd: 0, cStart: 0, cEnd: MIN_ACTIVE_MS, kind: "active" }],
      cMax: MIN_ACTIVE_MS,
      tMin: 0,
      tMax: 0
    };
  }

  // adaptive threshold: double gapMs until the burst count fits maxSegments
  let gapMs = opts?.gapMs ?? GAP_MS;
  for (;;) {
    let bursts = 1;
    for (let i = 1; i < total; i++) if (merged[i] - merged[i - 1] > gapMs) bursts++;
    if (bursts <= maxSegments) break;
    gapMs *= 2;
  }

  // active real spans between the gaps
  const starts: number[] = [merged[0]];
  const ends: number[] = [];
  for (let i = 1; i < total; i++) {
    if (merged[i] - merged[i - 1] > gapMs) {
      ends.push(merged[i - 1]);
      starts.push(merged[i]);
    }
  }
  ends.push(merged[total - 1]);

  // every gap gets the SAME compressed width, capped: seams read as "time
  // passed here" without any one idle stretch owning the axis. Computed from
  // floored active widths so gapCount * seamW <= seamShare * sumActive holds
  // even when every burst is a single event.
  const widths = starts.map((start, k) => Math.max(ends[k] - start, MIN_ACTIVE_MS));
  const sumActive = widths.reduce((acc, w) => acc + w, 0);
  const gapCount = starts.length - 1;
  const seamW = gapCount > 0 ? Math.min(seamCapMs, (seamShare * sumActive) / gapCount) : 0;

  const segments: AxisSegment[] = [];
  let c = 0;
  for (let k = 0; k < starts.length; k++) {
    if (k > 0) {
      segments.push({ realStart: ends[k - 1], realEnd: starts[k], cStart: c, cEnd: c + seamW, kind: "gap" });
      c += seamW;
    }
    segments.push({ realStart: starts[k], realEnd: ends[k], cStart: c, cEnd: c + widths[k], kind: "active" });
    c += widths[k];
  }
  return { segments, cMax: c, tMin: merged[0], tMax: merged[total - 1] };
}

// real -> compressed: exact monotone piecewise-linear map. Inside a seam, t
// interpolates linearly across the whole real gap, so a few pixels of drag
// fast-forward days. Out-of-range (or NaN) t clamps to the nearest endpoint.
export function compress(axis: GlobalAxis, t: number): number {
  if (Number.isNaN(t) || t <= axis.tMin) return 0;
  if (t >= axis.tMax) return axis.cMax;
  const segs = axis.segments;
  // last segment starting at or before t; shared boundaries resolve to the
  // later segment, which agrees with expand
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (segs[mid].realStart <= t) lo = mid;
    else hi = mid - 1;
  }
  const seg = segs[lo];
  const span = seg.realEnd - seg.realStart;
  if (span <= 0) return seg.cStart;
  return seg.cStart + ((t - seg.realStart) / span) * (seg.cEnd - seg.cStart);
}

// compressed -> real: exact inverse of compress. Out-of-range c clamps.
export function expand(axis: GlobalAxis, c: number): number {
  if (Number.isNaN(c) || c <= 0) return axis.tMin;
  if (c >= axis.cMax) return axis.tMax;
  const segs = axis.segments;
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (segs[mid].cStart <= c) lo = mid;
    else hi = mid - 1;
  }
  const seg = segs[lo];
  const span = seg.cEnd - seg.cStart;
  if (span <= 0) return seg.realStart;
  return seg.realStart + ((c - seg.cStart) / span) * (seg.realEnd - seg.realStart);
}

// compressed positions of active-burst boundaries for [ / ] jumps; ascending
// by construction (segments are laid out left to right)
export function segmentEdges(axis: GlobalAxis): number[] {
  const edges: number[] = [];
  for (const seg of axis.segments) {
    if (seg.kind === "active") edges.push(seg.cStart, seg.cEnd);
  }
  return edges;
}

// Timeline's bucket fold rebuilt in compressed-axis space: each of n buckets
// counts the lane's events landing in its compressed slice. Same dominant
// rule as Timeline — edits are rare but load-bearing, so the strictly-greater
// comparison lets earlier priority win the bucket color on ties. Empty
// buckets stay count 0 / "other".
export function laneBuckets(trace: Trace, times: Float64Array, axis: GlobalAxis, n = 160): LaneBucket[] {
  if (n <= 0) return [];
  const byAction: Map<Action, number>[] = Array.from({ length: n }, () => new Map());
  const totals = new Array<number>(n).fill(0);
  const count = Math.min(trace.events.length, times.length);
  for (let i = 0; i < count; i++) {
    const t = times[i];
    if (Number.isNaN(t)) continue;
    const c = compress(axis, t);
    const b = Math.min(n - 1, Math.max(0, Math.floor((c / axis.cMax) * n)));
    const action = trace.events[i].action;
    byAction[b].set(action, (byAction[b].get(action) ?? 0) + 1);
    totals[b]++;
  }
  const priority: Action[] = ["edit", "verify", "read", "search", "exec", "other"];
  const out: LaneBucket[] = [];
  for (let b = 0; b < n; b++) {
    let dominant: Action = "other";
    if (totals[b] > 0) {
      let best = -1;
      for (const action of priority) {
        const c = byAction[b].get(action) ?? 0;
        if (c > best) {
          best = c;
          dominant = action;
        }
      }
    }
    out.push({ count: totals[b], dominant });
  }
  return out;
}
