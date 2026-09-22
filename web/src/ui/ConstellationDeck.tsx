import { Ellipsis, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConstellationSpeed } from "../state/constellation";
import { expand, type GlobalAxis } from "../time/globalTimeline";
import type { Action } from "../types";
import { clock } from "./Timeline";

interface ConstellationDeckProps {
  axis: GlobalAxis;
  cursorC: number;
  playing: boolean;
  speed: ConstellationSpeed;
  activeCount: number;
  laneCount: number;
  onChange: (c: number) => void;
  onTogglePlay: () => void;
  onSpeed: (speed: ConstellationSpeed) => void;
  onJumpEdge: (dir: 1 | -1) => void;
}

// the transport ticks compressed milliseconds, not event indices: the whole
// span plays in ~90s at 1× no matter how many events or days it holds
const TICK_MS = 85;
const SPAN_PLAY_MS = 90_000;
const SPEEDS: ConstellationSpeed[] = [1, 4, 16];
// arrow nudge: fine enough to land inside any burst, coarse enough that a
// held key crosses the whole span in a few seconds
const NUDGE_DIVISOR = 500;

const STRIP_ACTIONS: Action[] = ["search", "read", "edit", "verify", "exec"];

/** weekday + date + Timeline's hh:mm:ss for a wall-clock millisecond — the
 * constellation's positions are real datetimes, never event counts */
export function wallLabel(t: number): string {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} ${clock(d.toISOString())}`;
}

export function ConstellationDeck({
  axis,
  cursorC,
  playing,
  speed,
  activeCount,
  laneCount,
  onChange,
  onTogglePlay,
  onSpeed,
  onJumpEdge
}: ConstellationDeckProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cMax = axis.cMax;
  // lanes can change under the cursor; clamp instead of trusting the store
  const cursor = Math.min(Math.max(cursorC, 0), cMax);
  const t = expand(axis, cursor);

  // the timer and shortcuts read position via a ref so ticking doesn't tear them down
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  useEffect(() => {
    if (!playing || cMax <= 0) return;
    const step = (cMax / (SPAN_PLAY_MS / TICK_MS)) * speed;
    const timer = window.setInterval(() => {
      if (cursorRef.current >= cMax) {
        onTogglePlay();
        return;
      }
      onChange(Math.min(cursorRef.current + step, cMax));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [playing, speed, cMax, onChange, onTogglePlay]);

  const cycleSpeed = useCallback(() => {
    onSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);
  }, [speed, onSpeed]);

  const nudge = useCallback(
    (mult: number) => {
      onChange(Math.min(cMax, Math.max(0, cursorRef.current + (cMax / NUDGE_DIVISOR) * mult)));
    },
    [cMax, onChange]
  );

  // global playback shortcuts; the single-session Timeline is unmounted while
  // the constellation is open, so the keys can't double-fire. Same focus
  // guard as Timeline: typing or clicking a control never moves the playhead.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, [contenteditable]")) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          onTogglePlay();
          return;
        case "ArrowLeft":
          e.preventDefault();
          nudge(e.shiftKey ? -10 : -1);
          return;
        case "ArrowRight":
          e.preventDefault();
          nudge(e.shiftKey ? 10 : 1);
          return;
        case "Home":
          e.preventDefault();
          onChange(0);
          return;
        case "End":
          e.preventDefault();
          onChange(cMax);
          return;
        case "[":
          e.preventDefault();
          onJumpEdge(-1);
          return;
        case "]":
          e.preventDefault();
          onJumpEdge(1);
          return;
      }
      if (e.key.toLowerCase() === "s") cycleSpeed();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cMax, onChange, onTogglePlay, onJumpEdge, nudge, cycleSpeed]);

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

  const gaps = useMemo(() => axis.segments.filter((seg) => seg.kind === "gap"), [axis]);

  return (
    <footer className="deck constellation-deck">
      <div className="deck-main">
        <div className="strip">
          {/* no bars here — those live per lane; the empty rail keeps the
              baseline so the scrubber reads as one instrument with the lanes */}
          <div className="strip-bars" aria-hidden />
          {gaps.map((gap, i) => (
            <span
              key={i}
              className="lane-gap"
              style={{
                left: `${(gap.cStart / cMax) * 100}%`,
                width: `${((gap.cEnd - gap.cStart) / cMax) * 100}%`
              }}
              title={`idle ${wallLabel(gap.realStart)} → ${wallLabel(gap.realEnd)}, compressed`}
              aria-hidden
            />
          ))}
          {cMax > 0 ? (
            <div className="strip-playhead" style={{ left: `${(cursor / cMax) * 100}%` }} aria-hidden />
          ) : null}
          <input
            className="strip-input"
            type="range"
            min={0}
            max={cMax}
            step="any"
            value={cursor}
            onChange={(e) => onChange(Number(e.currentTarget.value))}
            aria-label="Global playback position"
            aria-valuetext={wallLabel(t)}
          />
        </div>

        <div className="deck-pos">
          <span className="deck-pos-count">{`${activeCount} of ${laneCount} active`}</span>
          <span className="deck-pos-clock">{wallLabel(t)}</span>
        </div>

        <div className="transport">
          <button
            className="icon-btn"
            onClick={() => onJumpEdge(-1)}
            title="Previous activity burst ([)"
            aria-label="Jump to previous activity burst"
          >
            <SkipBack size={15} />
          </button>
          <button
            className="play-btn"
            onClick={onTogglePlay}
            title={playing ? "Pause (Space)" : "Play (Space)"}
            aria-label={playing ? "Pause playback" : "Play playback"}
          >
            {playing ? <Pause size={16} /> : <Play size={16} className="play-glyph" />}
          </button>
          <button
            className="icon-btn"
            onClick={() => onJumpEdge(1)}
            title="Next activity burst (])"
            aria-label="Jump to next activity burst"
          >
            <SkipForward size={15} />
          </button>
          <div className="transport-more" ref={menuRef}>
            {/* the trigger doubles as status: the engaged speed shows when it isn't 1× */}
            <button
              className={menuOpen ? "icon-btn open" : "icon-btn"}
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              title="More controls"
              aria-label="More playback controls"
            >
              {speed !== 1 ? <span className="more-speed">{speed}×</span> : <Ellipsis size={15} />}
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
                        onClick={() => onSpeed(s)}
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
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="deck-foot">
        <div className="readout-now">
          <span className="readout-summary">
            {`${wallLabel(axis.tMin)} → ${wallLabel(axis.tMax)} · idle gaps compressed to hatched seams`}
          </span>
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
        </div>
      </div>
    </footer>
  );
}
