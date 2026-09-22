import { Ellipsis, Loader, Pause, Play, RotateCcw, StepBack, StepForward, Video } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { Action, Mark, Trace, TraceEvent } from "../types";

interface TimelineProps {
  trace?: Trace;
  currentSeq: number;
  onChange: (seq: number) => void;
  onSubagentMark?: (seq: number) => void;
  onExport?: () => void;
  exporting?: boolean;
  /** fired alongside the jump on a still bucket click (never on a scrub);
   * the anchor is the clicked BAR's top-center — not the raw pointer — so a
   * detail card the owner lands there visually belongs to the bar.
   * The Timeline stays presentation-only — the card itself is the owner's. */
  onBucketClick?: (bucket: TimelineBucket, anchor: { x: number; y: number }) => void;
}

const BUCKETS = 160;
const BASE_TICK_MS = 340;
const SPEEDS = [1, 4, 16] as const;
type Speed = (typeof SPEEDS)[number];

export interface TimelineBucket {
  /** first event seq in the bucket — where a bucket click lands the playhead */
  from: number;
  /** one past the last event seq; from/to name the bucket's wall-time range */
  to: number;
  count: number;
  dominant: Action;
}

// marks that land on the same strip pixel collapse into one glyph; the title
// carries the count so dense sessions stay legible
interface MarkGroup {
  type: Mark["type"];
  seq: number;
  pos: number;
  count: number;
  note?: string;
}

const MARK_SLOTS = 220;

const MARK_LABEL: Record<Mark["type"], string> = {
  compaction: "context compaction",
  "user-message": "user message",
  subagent: "subagent"
};

const STRIP_ACTIONS: Action[] = ["search", "read", "edit", "verify", "exec"];

export function Timeline({
  trace,
  currentSeq,
  onChange,
  onSubagentMark,
  onExport,
  exporting = false,
  onBucketClick
}: TimelineProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const total = trace?.events.length ?? 0;
  const max = Math.max(0, total - 1);
  const seq = Math.min(currentSeq, max);
  const event = trace?.events[seq];

  useEffect(() => {
    setPlaying(false);
  }, [trace]);

  // while a video export is recording, the recorder owns the playhead — force
  // playback off so the Timeline timer can't fight it for currentSeq
  useEffect(() => {
    if (exporting) setPlaying(false);
  }, [exporting]);

  // the timer and shortcuts read position via refs so ticking doesn't tear them down
  const seqRef = useRef(seq);
  const maxRef = useRef(max);
  const playingRef = useRef(playing);
  seqRef.current = seq;
  maxRef.current = max;
  playingRef.current = playing;

  useEffect(() => {
    if (!playing || total === 0 || exporting) return;
    // higher speeds keep the render rate bounded by advancing several events per tick
    const interval = Math.max(85, BASE_TICK_MS / speed);
    const step = Math.max(1, Math.round((speed * interval) / BASE_TICK_MS));
    const timer = window.setInterval(() => {
      if (seqRef.current >= maxRef.current) {
        setPlaying(false);
        return;
      }
      onChange(Math.min(seqRef.current + step, maxRef.current));
    }, interval);
    return () => window.clearInterval(timer);
  }, [playing, speed, total, onChange, exporting]);

  const togglePlay = useCallback(() => {
    if (!playingRef.current && seqRef.current >= maxRef.current) onChange(0);
    setPlaying((v) => !v);
  }, [onChange]);

  const cycleSpeed = useCallback(() => {
    setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);
  }, []);

  const step = useCallback(
    (delta: number) => {
      onChange(Math.min(maxRef.current, Math.max(0, seqRef.current + delta)));
    },
    [onChange]
  );

  const jumpEvent = useCallback(
    (dir: 1 | -1, pred: (e: TraceEvent) => boolean) => {
      if (!trace) return;
      for (let i = seqRef.current + dir; i >= 0 && i < trace.events.length; i += dir) {
        if (pred(trace.events[i])) {
          onChange(i);
          return;
        }
      }
    },
    [trace, onChange]
  );

  const markSeqs = useMemo(() => {
    const clamped = (trace?.marks ?? []).map((mark) => Math.min(mark.seq, Math.max(0, (trace?.events.length ?? 1) - 1)));
    return [...new Set(clamped)].sort((a, b) => a - b);
  }, [trace]);

  const jumpMark = useCallback(
    (dir: 1 | -1) => {
      const cur = seqRef.current;
      const next = dir === 1 ? markSeqs.find((s) => s > cur) : [...markSeqs].reverse().find((s) => s < cur);
      if (next !== undefined) onChange(next);
    },
    [markSeqs, onChange]
  );

  // playback shortcuts; scene and rail keep their own (⌘B lives in App).
  // suspended while exporting so a keypress can't move the recorded playhead.
  useEffect(() => {
    if (!trace || exporting) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, [contenteditable]")) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          return;
        case "ArrowLeft":
          e.preventDefault();
          step(e.shiftKey ? -10 : -1);
          return;
        case "ArrowRight":
          e.preventDefault();
          step(e.shiftKey ? 10 : 1);
          return;
        case "Home":
          e.preventDefault();
          onChange(0);
          return;
        case "End":
          e.preventDefault();
          onChange(maxRef.current);
          return;
      }
      switch (e.key.toLowerCase()) {
        case "s":
          cycleSpeed();
          return;
        case "e":
          jumpEvent(e.shiftKey ? -1 : 1, (ev) => ev.action === "edit");
          return;
        case "x":
          jumpEvent(e.shiftKey ? -1 : 1, (ev) => ev.isError);
          return;
        case "m":
          jumpMark(e.shiftKey ? -1 : 1);
          return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [trace, exporting, togglePlay, step, onChange, cycleSpeed, jumpEvent, jumpMark]);

  // transport + scrubber are inert with no trace, or while an export owns the playhead
  const locked = total === 0 || exporting;

  useEffect(() => {
    if (locked) setMenuOpen(false);
  }, [locked]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const buckets = useMemo<TimelineBucket[]>(() => {
    if (!trace || total === 0) return [];
    const n = Math.min(BUCKETS, total);
    const out: TimelineBucket[] = [];
    for (let b = 0; b < n; b++) {
      const from = Math.floor((b * total) / n);
      const to = Math.floor(((b + 1) * total) / n);
      const byAction = new Map<Action, number>();
      for (let i = from; i < to; i++) {
        const action = trace.events[i].action;
        byAction.set(action, (byAction.get(action) ?? 0) + 1);
      }
      let dominant: Action = "other";
      let best = -1;
      // edits are rare but load-bearing: let them win the bucket color on ties
      const priority: Action[] = ["edit", "verify", "read", "search", "exec", "other"];
      for (const action of priority) {
        const count = byAction.get(action) ?? 0;
        if (count > best) {
          best = count;
          dominant = action;
        }
      }
      out.push({ from, to, count: to - from, dominant });
    }
    return out;
  }, [trace, total]);

  const peak = useMemo(() => buckets.reduce((acc, b) => Math.max(acc, b.count), 1), [buckets]);

  const markGroups = useMemo<MarkGroup[]>(() => {
    if (!trace) return [];
    const groups = new Map<string, MarkGroup>();
    for (const mark of trace.marks) {
      // tail marks can carry seq == events.length; clamp keeps them on the strip
      const seqC = Math.min(mark.seq, max);
      const pos = max > 0 ? seqC / max : 0;
      const key = `${mark.type}:${Math.round(pos * MARK_SLOTS)}`;
      const group = groups.get(key);
      if (group) {
        group.count++;
        group.seq = Math.min(group.seq, seqC);
      } else {
        groups.set(key, { type: mark.type, seq: seqC, pos, count: 1, note: mark.note });
      }
    }
    return [...groups.values()];
  }, [trace, max]);

  // native tooltip per bucket: "N events · dominant <action> · <wall range>";
  // sessions without usable timestamps degrade to an em dash, not a blank
  const bucketTitle = useCallback(
    (bucket: TimelineBucket) => {
      const a = clock(trace?.events[bucket.from]?.ts ?? "");
      const b = clock(trace?.events[bucket.to - 1]?.ts ?? "");
      const range = !a && !b ? "—" : !a || !b || a === b ? a || b : `${a} – ${b}`;
      return `${bucket.count} ${bucket.count === 1 ? "event" : "events"} · dominant ${bucket.dominant} · ${range}`;
    },
    [trace]
  );

  // a press on a bar becomes one of two gestures: a still click jumps to the
  // bucket's first event, a drag past the threshold scrubs like the range
  // input beneath (which keeps the band between the bars, and the keyboard)
  const barDrag = useRef<{ id: number; startX: number; dragged: boolean } | null>(null);

  const handleBarsPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    barDrag.current = { id: e.pointerId, startX: e.clientX, dragged: false };
  }, []);

  const handleBarsPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = barDrag.current;
      if (!drag || drag.id !== e.pointerId) return;
      if (!drag.dragged) {
        if (Math.abs(e.clientX - drag.startX) <= 3) return;
        drag.dragged = true;
        // capture on the pressed bar so a fast drag can leave the strip
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      onChange(Math.round(frac * maxRef.current));
    },
    [onChange]
  );

  const handleBarsPointerCancel = useCallback(() => {
    barDrag.current = null;
  }, []);

  // scrub releases end on the click event; consume the gesture there so a
  // drag never snaps to the bucket start under the pointer. A still click
  // both jumps AND reports the bucket upward, anchored on the bar itself
  // (top-center, never the raw pointer) — the owner may land a detail card
  // there; the jump behavior is unchanged.
  const handleBucketClick = useCallback(
    (bucket: TimelineBucket, e: ReactMouseEvent<HTMLSpanElement>) => {
      const drag = barDrag.current;
      barDrag.current = null;
      if (drag?.dragged) return;
      onChange(Math.min(bucket.from, maxRef.current));
      const rect = e.currentTarget.getBoundingClientRect();
      onBucketClick?.(bucket, { x: rect.left + rect.width / 2, y: rect.top });
    },
    [onChange, onBucketClick]
  );

  return (
    <footer className="deck">
      <div className="deck-main">
        <div className="strip">
          <div className="strip-marks">
            {markGroups.map((group, i) => (
              <button
                type="button"
                key={`${group.type}-${group.seq}-${i}`}
                className={`strip-mark ${group.type}`}
                style={{ left: `${group.pos * 100}%` }}
                disabled={locked}
                title={`${group.note || MARK_LABEL[group.type]}${group.count > 1 ? ` ×${group.count}` : ""}`}
                aria-label={`Jump to ${group.note || MARK_LABEL[group.type]} at event ${group.seq + 1}${group.count > 1 ? `, ${group.count} marks` : ""}`}
                onClick={() =>
                  group.type === "subagent" && onSubagentMark
                    ? onSubagentMark(group.seq)
                    : onChange(group.seq)
                }
              />
            ))}
          </div>
          {/* every bar is also a bucket button: click or Enter lands the
              playhead on the bucket's first event. The container stays
              pointer-transparent (see .strip-bars.pickable) so the range
              input keeps the empty band and every drag it always owned. */}
          <div
            className={locked ? "strip-bars" : "strip-bars pickable"}
            aria-hidden={locked || undefined}
            onPointerDown={locked ? undefined : handleBarsPointerDown}
            onPointerMove={locked ? undefined : handleBarsPointerMove}
            onPointerCancel={locked ? undefined : handleBarsPointerCancel}
          >
            {buckets.map((bucket, i) =>
              locked ? (
                <span
                  key={i}
                  className={`strip-bar ${bucket.dominant}`}
                  style={{ height: `${18 + (bucket.count / peak) * 82}%` }}
                />
              ) : (
                <span
                  key={i}
                  role="button"
                  tabIndex={0}
                  className={`strip-bar ${bucket.dominant}`}
                  style={{ height: `${18 + (bucket.count / peak) * 82}%` }}
                  title={bucketTitle(bucket)}
                  aria-label={`Jump to event ${bucket.from + 1} — ${bucketTitle(bucket)}`}
                  onClick={(e) => handleBucketClick(bucket, e)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    onChange(Math.min(bucket.from, maxRef.current));
                    // same bar-rect anchor as a pointer click
                    const rect = e.currentTarget.getBoundingClientRect();
                    onBucketClick?.(bucket, { x: rect.left + rect.width / 2, y: rect.top });
                  }}
                />
              )
            )}
          </div>
          {total > 0 ? (
            <div className="strip-playhead" style={{ left: `${(seq / Math.max(max, 1)) * 100}%` }} aria-hidden />
          ) : null}
          <input
            className="strip-input"
            type="range"
            min={0}
            max={max}
            value={seq}
            disabled={locked}
            onChange={(e) => onChange(Number(e.currentTarget.value))}
            aria-label="Playback position"
            aria-valuetext={event ? `event ${event.seq}: ${event.tool}` : "empty"}
          />
        </div>

        <div className="deck-pos">
          {/* reserve the widest count for this session ("599 / 599") so the
              ticking digits never resize the strip beside them */}
          <span className="deck-pos-count" style={{ minWidth: `${String(Math.max(total, 1)).length * 2 + 3}ch` }}>
            {total > 0 ? `${seq + 1} / ${total}` : "0 / 0"}
          </span>
          <span className="deck-pos-clock">{event?.ts ? clock(event.ts) : "—"}</span>
        </div>

        <div className="transport">
          <button
            className="icon-btn"
            onClick={() => step(-1)}
            disabled={locked}
            title="Step back (←)"
            aria-label="Step back one event"
          >
            <StepBack size={15} />
          </button>
          <button
            className="play-btn"
            onClick={togglePlay}
            disabled={locked}
            title={playing ? "Pause (Space)" : "Play (Space)"}
            aria-label={playing ? "Pause playback" : "Play playback"}
          >
            {playing ? <Pause size={16} /> : <Play size={16} className="play-glyph" />}
          </button>
          <button
            className="icon-btn"
            onClick={() => step(1)}
            disabled={locked}
            title="Step forward (→)"
            aria-label="Step forward one event"
          >
            <StepForward size={15} />
          </button>
          <div className="transport-more" ref={menuRef}>
            {/* the trigger doubles as status: recording spinner while an export
                runs, the engaged speed when it isn't 1× */}
            <button
              className={`icon-btn${exporting ? " recording" : ""}${menuOpen ? " open" : ""}`}
              onClick={() => setMenuOpen((v) => !v)}
              disabled={locked}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              title="More controls"
              aria-label="More playback controls"
            >
              {exporting ? (
                <Loader size={15} className="spin" />
              ) : speed !== 1 ? (
                <span className="more-speed">{speed}×</span>
              ) : (
                <Ellipsis size={15} />
              )}
            </button>
            {menuOpen ? (
              <div className="transport-pop">
                <div className="pop-speed">
                  <span className="pop-speed-label">Speed</span>
                  <div className="pop-speed-chips" title="Cycle with S">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        className={s === speed ? "pop-chip engaged" : "pop-chip"}
                        onClick={() => setSpeed(s)}
                        aria-pressed={s === speed}
                      >
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className="pop-item"
                  onClick={() => {
                    onChange(0);
                    setMenuOpen(false);
                  }}
                >
                  <RotateCcw size={14} />
                  <span>Restart</span>
                  <kbd>Home</kbd>
                </button>
                {onExport ? (
                  <button
                    className="pop-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onExport();
                    }}
                  >
                    <Video size={14} />
                    <span>Export video</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="deck-foot">
        <div className="readout-now">
          {event ? (
            <>
              <span className={`action-dot ${event.action}`} />
              <span className="readout-tool">{event.tool}</span>
              {event.isError ? <span className="err">error</span> : null}
              <span className="readout-summary" title={event.summary}>
                {event.summary}
              </span>
            </>
          ) : (
            <span className="readout-summary">
              {trace ? "No recorded activity for this agent." : "Select a session to start the walk."}
            </span>
          )}
        </div>
        <div className="deck-legend" aria-hidden>
          <span className="legend-group">
            {STRIP_ACTIONS.map((action) => (
              <span key={action} className="legend-item">
                <span className={`action-dot ${action}`} />
                {action}
              </span>
            ))}
          </span>
          <span className="legend-group">
            <span className="legend-item">
              <span className="legend-glyph compaction" />
              compaction
            </span>
            <span className="legend-item">
              <span className="legend-glyph subagent" />
              subagent
            </span>
            <span className="legend-item">
              <span className="legend-glyph user-message" />
              user turn
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}

export function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
}
