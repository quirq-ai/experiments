import { Earth, Maximize2, Orbit, Rows3, X } from "lucide-react";
import { createRef, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { describeError, getSessionSnapshot } from "../api/client";
import { mergePlaybacks } from "../playback/merge";
import { PlaybackEngine } from "../playback/reducer";
import { CityScene } from "../scene/CityScene";
import { TreeScene } from "../scene/TreeScene";
import { useConstellationStore } from "../state/constellation";
import { effectiveFilters, sessionVisible } from "../state/filters";
import { useAppStore } from "../state/store";
import {
  buildAxis,
  compress,
  expand,
  GAP_MS,
  laneBuckets,
  laneTimes,
  segmentEdges,
  seqAt,
  type GlobalAxis,
  type LaneBucket
} from "../time/globalTimeline";
import type { CityMap, SessionMeta, Trace } from "../types";
import { ConstellationDeck, wallLabel } from "./ConstellationDeck";
import { DetailCard, subtreeContent, type CardAnchor, type DetailContent } from "./DetailCard";

interface ConstellationViewProps {
  sessions: SessionMeta[];
  onOpenSession: (key: string, seq: number) => void;
}

const MAX_LANES = 8;
// concurrent WebGL budget: lanes past this render strip-only until focused
const MAX_SCENE_LANES = 6;
const BUCKETS = 160;

// a lane at time t: not started before its first event, ended past its last,
// idle when its latest event is more than a gap old — only "active" glows
type LaneStatus = "active" | "idle" | "not started" | "ended";

const noop = () => {};

export function ConstellationView({ sessions, onOpenSession }: ConstellationViewProps) {
  const {
    layout,
    selectedKeys,
    focusedKey,
    cursorC,
    playing,
    speed,
    loading,
    error,
    setOpen,
    setLayout,
    setSelectedKeys,
    toggleKey,
    setCursorC,
    setSpeed,
    setLoading,
    setError
  } = useConstellationStore();
  const hideEmpty = useAppStore((s) => s.hideEmpty);
  const harnessFilter = useAppStore((s) => s.harnessFilter);
  const folderFilter = useAppStore((s) => s.folderFilter);

  // heavy lane data stays out of zustand, mirroring App's actorTraceCache:
  // traces+citymaps and one incremental PlaybackEngine per lane
  const cacheRef = useRef(new Map<string, { trace: Trace; city: CityMap }>());
  const enginesRef = useRef(new Map<string, PlaybackEngine>());
  const fetchGen = useRef(0);
  const [version, setVersion] = useState(0);
  const [laneErrors, setLaneErrors] = useState<Record<string, string>>({});
  const lanesRef = useRef<HTMLDivElement | null>(null);
  const stripElRef = useRef<HTMLDivElement | null>(null);
  // the constellation's ONE detail-card slot. Scene-origin cards (arc,
  // branch, district) name the scene HOST they belong to — the card mounts
  // inside that host and the scene moves it with the pinned object; bucket
  // cards anchor on the clicked strip bar instead
  const [card, setCard] = useState<
    | { content: DetailContent; anchor: CardAnchor; host?: undefined }
    | { content: DetailContent; host: string; anchor?: undefined }
    | null
  >(null);
  const closeCard = useCallback(() => setCard(null), []);
  // one element slot per scene host: a world-anchored card hands its element
  // to the OWNING scene only, so a stale pin left in another lane can never
  // grab the card and fight over it frame by frame
  const cardHostRefs = useRef(new Map<string, RefObject<HTMLElement | null>>());
  const cardHostRef = useCallback((host: string): RefObject<HTMLElement | null> => {
    let ref = cardHostRefs.current.get(host);
    if (!ref) {
      ref = createRef<HTMLElement>();
      cardHostRefs.current.set(host, ref);
    }
    return ref;
  }, []);

  // a layout swap rebuilds the stage; a card aimed at the old one would dangle
  useEffect(() => {
    setCard(null);
  }, [layout]);

  const sessionsByKey = useMemo(() => new Map(sessions.map((s) => [s.key, s])), [sessions]);

  // the rail's filters decide what the constellation offers as lanes
  const pickable = useMemo(() => {
    const filters = effectiveFilters(sessions, { hideEmpty, harness: harnessFilter, folder: folderFilter });
    return sessions.filter((session) => sessionVisible(session, filters));
  }, [sessions, hideEmpty, harnessFilter, folderFilter]);

  // default lanes: filtered non-empty sessions, newest first, capped. Applied
  // once per mount so clearing every chip doesn't snap the defaults back.
  const defaultsApplied = useRef(false);
  useEffect(() => {
    if (defaultsApplied.current) return;
    if (selectedKeys.length > 0) {
      defaultsApplied.current = true;
      return;
    }
    const defaults = pickable
      .filter((session) => session.eventCount > 0)
      .sort((a, b) => (Date.parse(b.startedAt ?? "") || 0) - (Date.parse(a.startedAt ?? "") || 0))
      .slice(0, MAX_LANES)
      .map((session) => session.key);
    if (defaults.length === 0) return;
    defaultsApplied.current = true;
    setSelectedKeys(defaults);
  }, [selectedKeys, pickable, setSelectedKeys]);

  // fetch lanes the cache doesn't hold; a failed lane becomes an error row
  // without blocking the rest. Deselected lanes are evicted so the refs
  // track the selection.
  useEffect(() => {
    for (const key of [...cacheRef.current.keys()]) {
      if (!selectedKeys.includes(key)) {
        cacheRef.current.delete(key);
        enginesRef.current.delete(key);
      }
    }
    const missing = selectedKeys.filter((key) => !cacheRef.current.has(key));
    if (missing.length === 0) return;
    const gen = ++fetchGen.current;
    setLoading(true);
    setError(undefined);
    void Promise.allSettled(missing.map((key) => getSessionSnapshot(key))).then((results) => {
      if (gen !== fetchGen.current) return;
      const errs: Record<string, string> = {};
      results.forEach((result, i) => {
        const key = missing[i];
        if (result.status === "fulfilled") {
          cacheRef.current.set(key, result.value);
          enginesRef.current.set(key, new PlaybackEngine(result.value.trace, result.value.city));
        } else {
          errs[key] = describeError(result.reason, "loading the session");
        }
      });
      setLaneErrors((prev) => {
        const next: Record<string, string> = {};
        for (const key of selectedKeys) if (prev[key]) next[key] = prev[key];
        return { ...next, ...errs };
      });
      setLoading(false);
      setVersion((v) => v + 1);
    });
  }, [selectedKeys, setLoading, setError]);

  // unmount cancels in-flight fetches and releases the loading flag; the
  // store keeps cursorC/selectedKeys so reopening resumes in place
  useEffect(
    () => () => {
      fetchGen.current++;
      useConstellationStore.getState().setLoading(false);
    },
    []
  );

  // lane list in selection order; identity changes only when a fetch lands
  // or the selection does, so the axis math below memoizes against it
  const loaded = useMemo(() => {
    void version;
    return selectedKeys
      .map((key) => {
        const entry = cacheRef.current.get(key);
        const engine = enginesRef.current.get(key);
        if (!entry || !engine) return undefined;
        return { key, trace: entry.trace, city: entry.city, times: laneTimes(entry.trace), engine };
      })
      .filter((lane): lane is NonNullable<typeof lane> => lane !== undefined);
  }, [selectedKeys, version]);

  const axis = useMemo<GlobalAxis | undefined>(
    () => (loaded.length > 0 ? buildAxis(loaded.map((lane) => lane.times)) : undefined),
    [loaded]
  );

  const bucketsByKey = useMemo(() => {
    const out = new Map<string, { buckets: LaneBucket[]; peak: number }>();
    if (!axis) return out;
    for (const lane of loaded) {
      const buckets = laneBuckets(lane.trace, lane.times, axis, BUCKETS);
      const peak = buckets.reduce((acc, b) => Math.max(acc, b.count), 1);
      out.set(lane.key, { buckets, peak });
    }
    return out;
  }, [loaded, axis]);

  const edges = useMemo(() => (axis ? segmentEdges(axis) : []), [axis]);
  const gapSegs = useMemo(() => (axis ? axis.segments.filter((seg) => seg.kind === "gap") : []), [axis]);

  // stable handler targets for the deck: read the store directly so the
  // deck's tick interval never tears down mid-play
  const axisRef = useRef<GlobalAxis | undefined>(undefined);
  axisRef.current = axis;
  const edgesRef = useRef<number[]>([]);
  edgesRef.current = edges;

  const handleTogglePlay = useCallback(() => {
    const store = useConstellationStore.getState();
    const cMax = axisRef.current?.cMax ?? 0;
    // play from the end restarts, like Timeline's transport
    if (!store.playing && cMax > 0 && store.cursorC >= cMax) store.setCursorC(0);
    store.setPlaying(!store.playing);
  }, []);

  const handleJumpEdge = useCallback((dir: 1 | -1) => {
    const store = useConstellationStore.getState();
    const cur = store.cursorC;
    const list = edgesRef.current;
    const next = dir === 1 ? list.find((c) => c > cur + 1) : [...list].reverse().find((c) => c < cur - 1);
    if (next !== undefined) store.setCursorC(next);
  }, []);

  const toggleFocus = useCallback((key: string) => {
    const store = useConstellationStore.getState();
    store.setFocusedKey(store.focusedKey === key ? undefined : key);
  }, []);

  // Esc leaves focus mode; the deck owns every other shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const store = useConstellationStore.getState();
      if (store.focusedKey !== undefined) store.setFocusedKey(undefined);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const cursor = axis ? Math.min(Math.max(cursorC, 0), axis.cMax) : 0;

  // one derivation per cursor move: real time, then per lane the seq under
  // it, the engine's incremental fold, status, and the live touch tallies
  const laneViews = useMemo(() => {
    if (!axis) return [];
    const tNow = expand(axis, cursor);
    return loaded.map((lane) => {
      const seq = seqAt(lane.times, tNow);
      const snapshot = lane.engine.snapshotAt(seq);
      const last = lane.times.length > 0 ? lane.times[lane.times.length - 1] : Number.NaN;
      const status: LaneStatus =
        seq < 0
          ? "not started"
          : !Number.isNaN(last) && tNow > last
            ? "ended"
            : tNow - lane.times[seq] > GAP_MS
              ? "idle"
              : "active";
      const event = seq >= 0 ? lane.trace.events[seq] : undefined;
      let edited = 0;
      let read = 0;
      let seen = 0;
      for (const touch of snapshot.touchByPath.values()) {
        if (touch === "edit") edited++;
        else if (touch === "read") read++;
        else seen++;
      }
      return { ...lane, seq, snapshot, status, event, edited, read, seen };
    });
  }, [axis, cursor, loaded]);

  const laneViewByKey = useMemo(() => new Map(laneViews.map((lane) => [lane.key, lane])), [laneViews]);
  const activeCount = useMemo(
    () => laneViews.filter((lane) => lane.status === "active").length,
    [laneViews]
  );

  const pct = (c: number) => (axis ? `${(c / axis.cMax) * 100}%` : "0%");

  // one-world mode: sessions that share a workspace share a map, so render
  // ONE scene and union every walker's light onto it. Sessions from other
  // repos can't live on this map — they are named, not silently dropped.
  const oneWorld = useMemo(() => {
    if (laneViews.length === 0) return undefined;
    const groups = new Map<string, typeof laneViews>();
    for (const lane of laneViews) {
      const cwd = lane.trace.session.cwd || "?";
      const group = groups.get(cwd);
      if (group) group.push(lane);
      else groups.set(cwd, [lane]);
    }
    const [cwd, walkers] = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const excluded = laneViews.filter((lane) => (lane.trace.session.cwd || "?") !== cwd);
    const playback = mergePlaybacks(
      walkers.map((lane) => lane.snapshot),
      walkers.map((lane) => ({ events: lane.trace.events, seq: lane.seq })),
      walkers[0].city
    );
    return { cwd, walkers, excluded, playback, city: walkers[0].city };
  }, [laneViews]);

  // rows in selection order; scene budget counts loaded lanes only
  let sceneRank = 0;
  const rows = selectedKeys.map((key) => {
    const meta = sessionsByKey.get(key);
    const title = meta?.title || meta?.id || key;
    const err = laneErrors[key];
    if (err) {
      return (
        <div key={key} className="lane compact dormant">
          <div className="lane-meta">
            <span className="lane-title" title={title}>
              {title}
            </span>
          </div>
          <div className="lane-scene" />
          <div>
            <div className="lane-now">
              <div className="readout-now">
                <span className="err">error</span>
                <span className="readout-summary" title={err}>
                  {err}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    const lane = laneViewByKey.get(key);
    const bars = bucketsByKey.get(key);
    if (!lane || !bars || !axis) return null; // still fetching — the toast covers it
    const rank = sceneRank++;
    const focused = focusedKey === key;
    // focus mode unmounts every other 3D scene: one WebGL context, big canvas
    const showScene = focusedKey !== undefined ? focused : rank < MAX_SCENE_LANES;
    // scene-origin cards live in THIS lane's scene host, tracked by its pin
    const host = `lane:${key}`;
    // a clicked trail arc names one of THIS lane's events; the shared cursor
    // moves to its wall-clock moment. Half a millisecond in, so the
    // compress/expand float roundtrip can't land a hair before the event.
    // The jump stays as it was; the EVENT card is additive and carries the
    // owning session's title, since many lanes share this stage.
    const jumpToArc = (seq: number) => {
      const t = lane.times[Math.min(Math.max(seq, 0), lane.times.length - 1)];
      if (Number.isFinite(t)) setCursorC(compress(axis, t + 0.5));
      const event = lane.trace.events[seq];
      if (event) {
        setCard({
          content: { kind: "event", event, total: lane.trace.events.length, sessionTitle: title },
          host
        });
      }
    };
    const classes = ["lane"];
    if (focused) classes.push("focused");
    if (!showScene) classes.push("compact");
    if (lane.status !== "active") classes.push("dormant");
    return (
      <div key={key} className={classes.join(" ")}>
        <div
          className="lane-meta"
          onClick={() => toggleFocus(key)}
          title={focused ? "Unfocus (Esc)" : "Focus this lane"}
        >
          <span className="lane-title" title={title}>
            {title}
          </span>
          <span className="lane-sub muted">
            {harnessLabel(lane.trace.session.harness)} · {lane.trace.events.length}{" "}
            {lane.trace.events.length === 1 ? "call" : "calls"}
          </span>
          <span className="lane-tallies muted">
            {lane.edited} edited · {lane.read} read · {lane.seen} seen
          </span>
          {lane.status !== "active" ? <span className="lane-status">{lane.status}</span> : null}
          <button
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSession(key, Math.max(lane.seq, 0));
            }}
            title="Open this session in the walk view"
            aria-label={`Open ${title} in the walk view`}
          >
            <Maximize2 size={14} />
          </button>
        </div>
        <div className="lane-scene">
          {showScene ? (
            <TreeScene
              city={lane.city}
              playback={lane.snapshot}
              onSelect={noop}
              onTrailClick={jumpToArc}
              onRegionClick={(path) =>
                setCard({ content: subtreeContent(path, lane.city, lane.snapshot), host })
              }
              anchorElRef={cardHostRef(host)}
              onPinCleared={closeCard}
            />
          ) : null}
          {showScene && card?.host === host ? (
            <DetailCard content={card.content} anchorElRef={cardHostRef(host)} onClose={closeCard} />
          ) : null}
        </div>
        <div>
          <div
            className="lane-strip"
            ref={(el) => {
              // any strip works for the ruler's x→time mapping — they share the column
              if (el) stripElRef.current = el;
            }}
          >
            {/* occupied bars double as bucket buttons: click or Enter moves
                the shared cursor to the bucket's compressed center. Empty
                slots stay decoration, so clicks between bursts still reach
                the ruler's pin-anywhere click on the lane stack. */}
            <div className="strip-bars pickable">
              {bars.buckets.map((bucket, i) => {
                if (bucket.count === 0) {
                  return (
                    <span key={i} className={`strip-bar ${bucket.dominant}`} style={{ height: "0%" }} aria-hidden />
                  );
                }
                // LaneBucket carries no range: slice i of n IS its compressed
                // range, by the same arithmetic laneBuckets used to fill it
                const cStart = (i / bars.buckets.length) * axis.cMax;
                const cEnd = ((i + 1) / bars.buckets.length) * axis.cMax;
                const range = `${wallLabel(expand(axis, cStart))} → ${wallLabel(expand(axis, cEnd))}`;
                const label = `${bucket.count} ${bucket.count === 1 ? "event" : "events"} · dominant ${
                  bucket.dominant
                } · ${range}`;
                // the cursor jump stays as it was; the BUCKET card is
                // additive. Its roster is the lane's events whose compressed
                // time lands in slice i — the same arithmetic laneBuckets
                // used to fill the bucket, so count and roster always agree.
                const jump = (anchor: CardAnchor) => {
                  setCursorC((cStart + cEnd) / 2);
                  const n = bars.buckets.length;
                  const events = lane.trace.events.filter((_, idx) => {
                    const t = lane.times[idx];
                    if (Number.isNaN(t)) return false;
                    const c = compress(axis, t);
                    return Math.min(n - 1, Math.max(0, Math.floor((c / axis.cMax) * n))) === i;
                  });
                  setCard({
                    content: {
                      kind: "bucket",
                      events,
                      range,
                      // a row names one of THIS lane's events: same
                      // wall-clock hop as an arc click, half a millisecond in
                      onJumpTo: (seq: number) => {
                        const t = lane.times[Math.min(Math.max(seq, 0), lane.times.length - 1)];
                        if (Number.isFinite(t)) setCursorC(compress(axis, t + 0.5));
                      }
                    },
                    anchor
                  });
                };
                return (
                  <span
                    key={i}
                    role="button"
                    tabIndex={0}
                    className={`strip-bar ${bucket.dominant}`}
                    style={{ height: `${18 + (bucket.count / bars.peak) * 82}%` }}
                    title={label}
                    aria-label={`Move the shared cursor here — ${label}`}
                    onClick={(e) => {
                      // the card anchors on the bar itself (top-center), not
                      // the raw pointer, so it reads as belonging to the bar
                      const rect = e.currentTarget.getBoundingClientRect();
                      jump({ x: rect.left + rect.width / 2, y: rect.top });
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      // same bar-rect anchor as a pointer click
                      const rect = e.currentTarget.getBoundingClientRect();
                      jump({ x: rect.left + rect.width / 2, y: rect.top });
                    }}
                  />
                );
              })}
            </div>
            {gapSegs.map((gap, i) => (
              <span
                key={i}
                className="lane-gap"
                style={{ left: pct(gap.cStart), width: pct(gap.cEnd - gap.cStart) }}
                title={`idle ${fmtDuration(gap.realEnd - gap.realStart)} — compressed to a seam`}
              >
                {`· ${fmtDuration(gap.realEnd - gap.realStart)} ·`}
              </span>
            ))}
            <div className="strip-playhead" style={{ left: pct(cursor) }} aria-hidden />
          </div>
          <div className="lane-now">
            <div className="readout-now">
              {lane.status === "active" && lane.event ? (
                <>
                  <span className={`action-dot ${lane.event.action}`} />
                  <span className="readout-tool">{lane.event.tool}</span>
                  {lane.event.isError ? <span className="err">error</span> : null}
                  <span className="readout-summary" title={lane.event.summary.replace(/\s+/g, " ")}>
                    {lane.event.summary}
                  </span>
                </>
              ) : (
                <span className="readout-summary">{lane.status}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  });

  return (
    <div className="constellation">
      <div className="constellation-hud">
        <div className="lane-picker" role="group" aria-label="Constellation lanes">
          {pickable.map((session) => {
            const active = selectedKeys.includes(session.key);
            const capped = !active && selectedKeys.length >= MAX_LANES;
            return (
              <button
                key={session.key}
                className={active ? "chip active" : "chip"}
                disabled={capped}
                onClick={() => toggleKey(session.key)}
                title={
                  active
                    ? `Remove ${session.title || session.id}`
                    : capped
                      ? `Lane cap reached (${MAX_LANES}) — remove a lane first`
                      : `Add ${session.title || session.id}`
                }
                aria-pressed={active}
              >
                {chipLabel(session)}
              </button>
            );
          })}
        </div>
        <span className="muted">{`${selectedKeys.length} of ${MAX_LANES} lanes`}</span>
        <button
          className={layout === "lanes" ? "icon-btn active" : "icon-btn"}
          onClick={() => setLayout("lanes")}
          title="Lanes — strips on the shared axis"
          aria-label="Lane layout"
          aria-pressed={layout === "lanes"}
        >
          <Rows3 size={15} />
        </button>
        <button
          className={layout === "one" ? "icon-btn active" : "icon-btn"}
          onClick={() => setLayout("one")}
          title="One world — every session on the shared map"
          aria-label="One world layout"
          aria-pressed={layout === "one"}
        >
          <Orbit size={15} />
        </button>
        <button
          className={layout === "world" ? "icon-btn active" : "icon-btn"}
          onClick={() => setLayout("world")}
          title="World — every folder a district, all sessions on one terrain"
          aria-label="World layout"
          aria-pressed={layout === "world"}
        >
          <Earth size={15} />
        </button>
        <button
          className="icon-btn"
          onClick={() => setOpen(false)}
          title="Exit constellation"
          aria-label="Exit constellation"
        >
          <X size={15} />
        </button>
      </div>
      {layout === "one" || layout === "world" ? (
        <div className="one-world">
          {oneWorld ? (
            <>
              <div className="one-world-scene">
                {/* a district/branch click opens the SUBTREE card over the
                    merged playback: the union's numbers, not one walker's.
                    The card mounts in this host and the scene tracks the pin */}
                {layout === "world" ? (
                  // the terrain IS the world map: every folder a district,
                  // mountains where the sessions collectively lingered
                  <CityScene
                    city={oneWorld.city}
                    playback={oneWorld.playback}
                    onSelect={noop}
                    onRegionClick={(path) =>
                      setCard({ content: subtreeContent(path, oneWorld.city, oneWorld.playback), host: "world" })
                    }
                    anchorElRef={cardHostRef("world")}
                    onPinCleared={closeCard}
                  />
                ) : (
                  <TreeScene
                    city={oneWorld.city}
                    playback={oneWorld.playback}
                    onSelect={noop}
                    onRegionClick={(path) =>
                      setCard({ content: subtreeContent(path, oneWorld.city, oneWorld.playback), host: "world" })
                    }
                    anchorElRef={cardHostRef("world")}
                    onPinCleared={closeCard}
                  />
                )}
                {card?.host === "world" ? (
                  <DetailCard content={card.content} anchorElRef={cardHostRef("world")} onClose={closeCard} />
                ) : null}
              </div>
              <div className="one-world-chips">
                {oneWorld.walkers.map((lane) => {
                  const meta = sessionsByKey.get(lane.key);
                  const title = meta?.title || meta?.id || lane.key;
                  return (
                    <button
                      key={lane.key}
                      className={lane.status === "active" ? "world-chip active" : "world-chip"}
                      onClick={() => onOpenSession(lane.key, Math.max(lane.seq, 0))}
                      title={`${title} — open in the walk view at this moment`}
                    >
                      <span className="lane-title">{title}</span>
                      {lane.status === "active" && lane.event ? (
                        <span className="world-chip-now">
                          <span className={`action-dot ${lane.event.action}`} />
                          <span className="readout-tool">{lane.event.tool}</span>
                        </span>
                      ) : (
                        <span className="world-chip-now muted">{lane.status}</span>
                      )}
                    </button>
                  );
                })}
                {oneWorld.excluded.length > 0 ? (
                  <span
                    className="world-chip muted"
                    title={`Different repo than ${oneWorld.cwd}: ${oneWorld.excluded
                      .map((lane) => sessionsByKey.get(lane.key)?.title || lane.key)
                      .join(", ")}`}
                  >
                    {oneWorld.excluded.length} in other repos
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="muted" style={{ padding: "14px 18px" }}>
              {selectedKeys.length === 0
                ? "No sessions selected — pick sessions above to light the world."
                : "Loading the world…"}
            </p>
          )}
        </div>
      ) : (
        <div className="constellation-lanes" ref={lanesRef}>
          {rows}
          {selectedKeys.length === 0 ? (
            <p className="muted" style={{ padding: "14px 18px" }}>
              No lanes selected — pick sessions above to build the constellation.
            </p>
          ) : null}
          {axis ? (
            <HoverRuler containerRef={lanesRef} stripRef={stripElRef} axis={axis} onPin={setCursorC} />
          ) : null}
        </div>
      )}
      {axis ? (
        <ConstellationDeck
          axis={axis}
          cursorC={cursor}
          playing={playing}
          speed={speed}
          activeCount={activeCount}
          laneCount={laneViews.length}
          onChange={setCursorC}
          onTogglePlay={handleTogglePlay}
          onSpeed={setSpeed}
          onJumpEdge={handleJumpEdge}
        />
      ) : null}
      {/* the bucket card is DOM-anchored: it points at its strip bar */}
      {card?.anchor ? <DetailCard content={card.content} anchor={card.anchor} onClose={closeCard} /> : null}
      {loading ? <div className="toast">Reading traces…</div> : null}
      {error ? <div className="toast error">{error}</div> : null}
    </div>
  );
}

interface HoverRulerProps {
  containerRef: RefObject<HTMLDivElement | null>;
  stripRef: RefObject<HTMLDivElement | null>;
  axis: GlobalAxis;
  onPin: (c: number) => void;
}

// one vertical line through every lane: hovering the strip column reads the
// shared axis as a real datetime, clicking pins the playhead there. Hover
// state lives here so pointer moves never re-render the lane stack.
function HoverRuler({ containerRef, stripRef, axis, onPin }: HoverRulerProps) {
  const [hover, setHover] = useState<{ x: number; c: number } | null>(null);
  const axisRef = useRef(axis);
  axisRef.current = axis;
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const locate = (e: PointerEvent | MouseEvent): { x: number; c: number } | null => {
      // every row shape keeps the same strip column, but mapping against the
      // strip under the pointer stays robust if that ever changes; between
      // rows, fall back to the last-seen strip
      const under = (e.target as HTMLElement | null)?.closest?.(".lane-strip");
      const strip = (under as HTMLElement | null) ?? stripRef.current;
      if (!strip) return null;
      const stripRect = strip.getBoundingClientRect();
      if (stripRect.width <= 0 || e.clientX < stripRect.left || e.clientX > stripRect.right) return null;
      const containerRect = container.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (e.clientX - stripRect.left) / stripRect.width));
      return { x: e.clientX - containerRect.left, c: frac * axisRef.current.cMax };
    };
    const onMove = (e: PointerEvent) => setHover(locate(e));
    const onLeave = () => setHover(null);
    const onClick = (e: MouseEvent) => {
      // bucket bars own their clicks (they jump to the bucket's center, and
      // this native listener fires before their React handlers could stop it)
      if ((e.target as HTMLElement | null)?.closest?.(".strip-bar")) return;
      const hit = locate(e);
      if (hit) onPinRef.current(hit.c);
    };
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    container.addEventListener("click", onClick);
    return () => {
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
      container.removeEventListener("click", onClick);
    };
  }, [containerRef, stripRef]);

  if (!hover) return null;
  return (
    <div className="constellation-ruler" style={{ left: `${hover.x}px` }} aria-hidden>
      <span className="constellation-ruler-label">{wallLabel(expand(axis, hover.c))}</span>
    </div>
  );
}

// SessionRail keeps its harness vocabulary private; the lane meta speaks the same
function harnessLabel(harness: string): string {
  return harness === "claude-code" ? "claude" : harness;
}

function chipLabel(session: SessionMeta): string {
  const label = session.title || session.id;
  return label.length > 28 ? `${label.slice(0, 27)}…` : label;
}

// seam labels carry the real duration the axis skipped: two units, no noise
function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
