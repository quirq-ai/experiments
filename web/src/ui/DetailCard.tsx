import { AlertTriangle, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { getRepoCommit, type CommitDetail } from "../api/client";
import type { FilePlayback } from "../playback/reducer";
import { touchWord, type Action, type CityMap, type Touch, type TraceEvent } from "../types";
import { wallLabel } from "./ConstellationDeck";
import { clock } from "./Timeline";

/** where a DOM-anchored card points: the clicked bar's top-center; the card
 * sits centered above it, clamped into the viewport */
export interface CardAnchor {
  x: number;
  y: number;
}

/** the three depths a line click can open. One discriminated union keeps the
 * card a single dumb surface: every view builds plain data plus the jump
 * callbacks that make sense in ITS coordinate system, and the card renders. */
export type DetailContent =
  | {
      kind: "event";
      event: TraceEvent;
      /** trace length, for "event N of TOTAL" */
      total: number;
      /** owning session — shown in constellation contexts only */
      sessionTitle?: string;
      /** set when the trace is a synthesized git history: the event is a
       * commit, and the card fetches its diff from this repo on open */
      git?: { repo: string };
    }
  | {
      kind: "bucket";
      events: TraceEvent[];
      /** wall-range label override (the constellation's compressed range);
       * absent = derived from the events' own clocks */
      range?: string;
      /** a row click lands the owning view's playhead on that exact event */
      onJumpTo: (seq: number) => void;
    }
  | {
      kind: "subtree";
      path: string;
      fileCount: number;
      /** LOC when the city provides it */
      lines?: number;
      edited: number;
      read: number;
      seen: number;
      visits: number;
      /** the whole walk's visit total, for the share headline */
      totalVisits: number;
      /** wall times of the subtree's first and last touch, when clocked */
      firstTs?: string;
      lastTs?: string;
      topFiles: { path: string; visits: number; touch?: Touch }[];
      /** absent (constellation) keeps the file rows informational */
      onSelectFile?: (path: string) => void;
    };

interface DetailCardProps {
  content: DetailContent;
  /** DOM-anchored mode: land centered above this viewport point (a bucket
   * card points at its bar). Exactly one of anchor/anchorElRef is given. */
  anchor?: CardAnchor;
  /** world-anchored mode: the card hands its element up through this ref and
   * the owning scene moves it every frame to track the pinned object — the
   * card never sets left/top itself */
  anchorElRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
}

const VIEWPORT_MARGIN = 16;
/** breathing room between a DOM-anchored card and the bar it points at */
const ANCHOR_GAP = 10;
const MAX_BUCKET_ROWS = 10;

/** SUBTREE content from a folder path + a city + a playback snapshot: file
 * count and LOC from the city, touch tallies and visits joined via city file
 * ids under the path prefix, first/last wall times from the path histories.
 * Shared by the walk view and every constellation layout so the numbers can
 * never drift between them. */
export function subtreeContent(
  path: string,
  city: CityMap,
  playback: FilePlayback,
  onSelectFile?: (path: string) => void
): DetailContent {
  const prefix = path === "" ? "" : `${path}/`;
  const dir = city.dirs.find((d) => d.path === path);
  let fileCount = 0;
  let edited = 0;
  let read = 0;
  let seen = 0;
  let visits = 0;
  const visited: { path: string; visits: number; touch?: Touch }[] = [];
  for (const file of city.files) {
    if (prefix !== "" && !file.path.startsWith(prefix)) continue;
    fileCount++;
    const touch = playback.touchByFile.get(file.id);
    if (touch === "edit") edited++;
    else if (touch === "read") read++;
    else if (touch === "hit") seen++;
    const v = playback.visitsByFile.get(file.id) ?? 0;
    visits += v;
    if (v > 0) visited.push({ path: file.path, visits: v, touch });
  }
  let totalVisits = 0;
  for (const v of playback.visitsByFile.values()) totalVisits += v;
  // each path's history is already seq-ordered, so its two ends bound that
  // path; min/max across the prefix bounds the subtree — the cheapest
  // correct derivation available. Unclocked events simply don't compete.
  let firstTs: string | undefined;
  let lastTs: string | undefined;
  for (const [histPath, events] of playback.historyByPath) {
    if (prefix !== "" && !histPath.startsWith(prefix)) continue;
    const a = events[0]?.ts;
    const b = events[events.length - 1]?.ts;
    if (a && !Number.isNaN(Date.parse(a)) && (!firstTs || Date.parse(a) < Date.parse(firstTs))) firstTs = a;
    if (b && !Number.isNaN(Date.parse(b)) && (!lastTs || Date.parse(b) > Date.parse(lastTs))) lastTs = b;
  }
  visited.sort((a, b) => b.visits - a.visits || (a.path < b.path ? -1 : 1));
  return {
    kind: "subtree",
    path: path === "" ? "/" : path,
    fileCount: dir?.fileCount ?? fileCount,
    lines: dir?.lines,
    edited,
    read,
    seen,
    visits,
    totalVisits,
    firstTs,
    lastTs,
    topFiles: visited.slice(0, 5),
    onSelectFile
  };
}

// One floating dismissable card per view. The owning view holds ONE card slot
// in local state, so a second click replaces the card instead of stacking;
// this component owns only geometry, dismissal, and the three renderings.
// Two geometries: DOM-anchored (centered above a bar, viewport-clamped here)
// and world-anchored (the scene owns left/top and tracks the pinned object).
export function DetailCard({ content, anchor, anchorElRef, onClose }: DetailCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<CardAnchor>(anchor ?? { x: 0, y: 0 });

  // world-anchored: hand the element to the scene and get out of the way —
  // it projects the pinned world point and moves the card every frame
  useLayoutEffect(() => {
    if (!anchorElRef) return;
    anchorElRef.current = ref.current;
    return () => {
      anchorElRef.current = null;
    };
  }, [anchorElRef]);

  // DOM-anchored: center above the anchor point, clamped into the viewport
  // with 16px margins once the size is known; the stylesheet fixes the width,
  // so one post-render measure settles it
  useLayoutEffect(() => {
    if (anchorElRef || !anchor) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: Math.max(
        VIEWPORT_MARGIN,
        Math.min(anchor.x - rect.width / 2, window.innerWidth - rect.width - VIEWPORT_MARGIN)
      ),
      y: Math.max(
        VIEWPORT_MARGIN,
        Math.min(anchor.y - rect.height - ANCHOR_GAP, window.innerHeight - rect.height - VIEWPORT_MARGIN)
      )
    });
  }, [anchor, anchorElRef, content]);

  // dismissal mirrors the dock pop: Esc or any press outside. The pointerdown
  // that OPENED the card finished before this effect attaches, so it never
  // self-dismisses; Esc is guarded for inputs, like the app's other shortcuts.
  // One carve-out: a world-anchored card delegates presses on ITS scene's
  // canvas to the scene — a drag orbits while the pin keeps the card true,
  // an empty-ground click clears the pin (onPinCleared closes us), and a new
  // pick replaces the card. Without it, grabbing the camera would close the
  // card before the tracking it exists for could ever show.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || ref.current?.contains(target)) return;
      if (anchorElRef && target.closest?.("canvas") && ref.current?.parentElement?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, anchorElRef]);

  return (
    <div
      className={anchorElRef ? "detail-card world-anchored" : "detail-card"}
      ref={ref}
      style={anchorElRef ? undefined : { left: pos.x, top: pos.y }}
      role="dialog"
      aria-label={cardLabel(content)}
    >
      {content.kind === "event" ? <EventCard content={content} onClose={onClose} /> : null}
      {content.kind === "bucket" ? <BucketCard content={content} onClose={onClose} /> : null}
      {content.kind === "subtree" ? <SubtreeCard content={content} onClose={onClose} /> : null}
    </div>
  );
}

function cardLabel(content: DetailContent): string {
  switch (content.kind) {
    case "event":
      return `Event ${content.event.seq + 1} details`;
    case "bucket":
      return `${content.events.length} ${content.events.length === 1 ? "event" : "events"}`;
    case "subtree":
      return `Folder ${content.path}`;
  }
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close detail card">
      <X size={14} />
    </button>
  );
}

function EventCard({
  content,
  onClose
}: {
  content: Extract<DetailContent, { kind: "event" }>;
  onClose: () => void;
}) {
  const { event, total, sessionTitle, git } = content;
  // git flavor: the trace keeps commits light (numstat paths only), so the
  // full diff is fetched lazily when the card opens; a failure stays silent —
  // the numstat target rows below already name the commit's files
  const repo = git?.repo;
  const hash = git ? shortHash(event.tool) : undefined;
  const [commit, setCommit] = useState<CommitDetail | undefined>();
  useEffect(() => {
    setCommit(undefined);
    if (!repo || !hash || !/^[0-9a-f]{7,40}$/i.test(hash)) return;
    let cancelled = false;
    getRepoCommit(repo, hash)
      .then((detail) => {
        if (!cancelled) setCommit(detail);
      })
      .catch(() => {
        // silent degrade to the numstat rows
      });
    return () => {
      cancelled = true;
    };
  }, [repo, hash]);

  const gitSummary = git ? splitGitSummary(event.summary) : undefined;
  const headline = git ? gitHeadline(event, gitSummary?.churn) : eventHeadline(event);
  const age = event.ts ? relativeAge(event.ts) : "";
  const targetRows =
    event.targets.length > 0 ? (
      <ul className="detail-card-targets">
        {event.targets.map((target, i) => (
          <li key={`${target.path}-${i}`}>
            <span className="detail-card-path">{target.path}</span>
            <span className={`detail-card-touch touch-${target.touch}`}>{touchWord(target.touch)}</span>
            {target.lines && target.lines.length > 0 ? (
              <span className="detail-card-lines">{linesLabel(target.lines)}</span>
            ) : null}
          </li>
        ))}
      </ul>
    ) : null;
  return (
    <>
      <div className="detail-card-head">
        <span className={`action-dot ${event.action}`} />
        <span className="detail-card-title">{hash ?? event.tool}</span>
        {event.isError ? <span className="err">error</span> : null}
        <CloseButton onClose={onClose} />
      </div>
      <div className="detail-card-body">
        {sessionTitle ? <p className="detail-card-session muted">{sessionTitle}</p> : null}
        {headline ? <p className="detail-card-headline">{headline}</p> : null}
        <p className="detail-card-meta">
          <span>{event.ts ? `${wallLabel(Date.parse(event.ts))}${age ? ` · ${age}` : ""}` : "—"}</span>
          <span>{`event ${event.seq + 1} of ${total}`}</span>
        </p>
        <p className="detail-card-summary">{gitSummary ? gitSummary.body : event.summary}</p>
        {event.isError ? <p className="detail-card-errline">returned an error</p> : null}
        {commit ? (
          // the fetched diff supersedes the plain rows: same paths, richer —
          // per-file churn counts, then the raw patch (any trailing
          // "… truncated" marker from the server renders as-is)
          <>
            <p className="eyebrow">Diff</p>
            <ul className="detail-card-targets">
              {commit.files.map((file, i) => (
                <li key={`${file.path}-${i}`}>
                  <span className="detail-card-path">{file.path}</span>
                  <span className="detail-card-churn">{`+${file.insertions} −${file.deletions}`}</span>
                </li>
              ))}
            </ul>
            <pre className="detail-card-patch">{commit.patch}</pre>
          </>
        ) : (
          targetRows
        )}
        {event.outside && event.outside.length > 0 ? (
          <p className="detail-card-outside muted">
            {`also touched ${event.outside.length} ${event.outside.length === 1 ? "path" : "paths"} outside the repo`}
          </p>
        ) : null}
        {/* a commit's resultBytes is its churn proxy, not tool output — the
            headline already carries +X −Y, so the bytes line would only lie */}
        {git ? null : <p className="detail-card-bytes muted">{`${humanBytes(event.resultBytes)} output`}</p>}
      </div>
    </>
  );
}

/** "commit abc1234" → "abc1234" — the git card head shows the bare hash */
function shortHash(tool: string): string {
  return tool.replace(/^commit\s+/, "");
}

/** the git event summary is "<subject> — <author> · +<ins> −<del>"; split the
 * churn tail off so the headline carries it and the body keeps the
 * subject — author line. An unexpected shape degrades to the whole summary. */
function splitGitSummary(summary: string): { body: string; churn?: string } {
  const match = summary.match(/^([\s\S]*?)\s·\s(\+\d+\s[−-]\d+)$/);
  if (!match) return { body: summary };
  return { body: match[1], churn: match[2] };
}

/** the git EVENT headline: "Committed N files · +X −Y" — churn straight from
 * the summary tail, so it can never disagree with the deck readout */
function gitHeadline(event: TraceEvent, churn?: string): string {
  const n = event.targets.length;
  return `Committed ${n} ${n === 1 ? "file" : "files"}${churn ? ` · ${churn}` : ""}`;
}

// same priority vocabulary as the strip legends
const ACTION_ORDER: Action[] = ["search", "read", "edit", "verify", "exec", "other"];

function BucketCard({
  content,
  onClose
}: {
  content: Extract<DetailContent, { kind: "bucket" }>;
  onClose: () => void;
}) {
  const { events, onJumpTo } = content;
  const shown = events.slice(0, MAX_BUCKET_ROWS);
  const extra = events.length - shown.length;
  const errors = events.reduce((acc, event) => acc + (event.isError ? 1 : 0), 0);
  const byAction = new Map<Action, number>();
  for (const event of events) byAction.set(event.action, (byAction.get(event.action) ?? 0) + 1);
  const span = eventsSpan(events);
  const busiest = busiestPath(events);
  return (
    <>
      <div className="detail-card-head">
        <span className="detail-card-title">
          {`${events.length} ${events.length === 1 ? "event" : "events"}${span ? ` over ${span}` : ""}`}
        </span>
        <CloseButton onClose={onClose} />
      </div>
      <div className="detail-card-body">
        <p className="detail-card-meta">
          <span>{content.range ?? eventsRange(events)}</span>
          {errors > 0 ? <span className="err">{`${errors} ${errors === 1 ? "error" : "errors"}`}</span> : null}
        </p>
        <p className="detail-card-counts">
          {ACTION_ORDER.filter((action) => byAction.has(action)).map((action) => (
            <span key={action} className="detail-card-count">
              <span className={`action-dot ${action}`} />
              {byAction.get(action)}
            </span>
          ))}
        </p>
        {busiest ? (
          <p className="detail-card-busiest muted">
            {"mostly "}
            <code>{busiest.path}</code>
            {` · ${busiest.touches} ${busiest.touches === 1 ? "touch" : "touches"}`}
          </p>
        ) : null}
        <div className="detail-card-rows">
          {shown.map((event) => (
            <button
              key={event.seq}
              className="detail-card-row"
              onClick={() => onJumpTo(event.seq)}
              title={`Jump to event ${event.seq + 1} — ${event.summary}`}
            >
              <span className={`action-dot ${event.action}`} />
              <span className="detail-card-row-time">{event.ts ? clock(event.ts) : "—"}</span>
              <span className="detail-card-row-tool">{event.tool}</span>
              <span className="detail-card-row-summary">{event.summary}</span>
              {event.isError ? <AlertTriangle className="history-err" size={12} /> : <span />}
            </button>
          ))}
          {extra > 0 ? <p className="detail-card-more muted">{`+${extra} more`}</p> : null}
        </div>
      </div>
    </>
  );
}

function SubtreeCard({
  content,
  onClose
}: {
  content: Extract<DetailContent, { kind: "subtree" }>;
  onClose: () => void;
}) {
  // guard the divide: an unvisited subtree (or a walk with no visits at all)
  // simply has no share to headline
  const share =
    content.totalVisits > 0 && content.visits > 0
      ? Math.round((content.visits / content.totalVisits) * 100)
      : undefined;
  return (
    <>
      <div className="detail-card-head">
        <span className="detail-card-title detail-card-folder">{content.path}</span>
        <CloseButton onClose={onClose} />
      </div>
      <div className="detail-card-body">
        {share !== undefined ? (
          <p className="detail-card-headline">{`${share === 0 ? "<1" : share}% of this session's visits`}</p>
        ) : null}
        <p className="detail-card-meta">
          <span>{`${content.fileCount} ${content.fileCount === 1 ? "file" : "files"}`}</span>
          {content.lines !== undefined ? <span>{`${content.lines.toLocaleString()} lines`}</span> : null}
        </p>
        <p className="detail-card-tallies">
          <span className="detail-card-count">
            <span className="legend-dot edit" />
            {`${content.edited} edited`}
          </span>
          <span className="detail-card-count">
            <span className="legend-dot read" />
            {`${content.read} read`}
          </span>
          <span className="detail-card-count">
            <span className="legend-dot hit" />
            {`${content.seen} seen`}
          </span>
          <span className="detail-card-count">{`${content.visits} visits`}</span>
        </p>
        {content.firstTs && content.lastTs ? (
          <p className="detail-card-window muted">
            {clock(content.firstTs) === clock(content.lastTs)
              ? `touched at ${clock(content.firstTs)}`
              : `first touched ${dayClock(content.firstTs, content.lastTs)} · last ${dayClock(
                  content.lastTs,
                  content.firstTs
                )}`}
          </p>
        ) : null}
        {content.topFiles.length > 0 ? (
          <>
            <p className="eyebrow">Most visited</p>
            <div className="detail-card-rows">
              {content.topFiles.map((file) => (
                <button
                  key={file.path}
                  className="detail-card-file-row"
                  onClick={() => content.onSelectFile?.(file.path)}
                  title={content.onSelectFile ? `Select ${file.path}` : file.path}
                >
                  <span className={`legend-dot ${file.touch ?? "unvisited"}`} />
                  <span className="detail-card-row-file">{file.path}</span>
                  <span className="detail-card-row-visits">{file.visits}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">No visits inside this folder at this point of the walk.</p>
        )}
      </div>
    </>
  );
}

/** one headline sentence built from the action — what happened, at a glance */
function eventHeadline(event: TraceEvent): string {
  const n = event.targets.length;
  const files = `${n} ${n === 1 ? "file" : "files"}`;
  const lines = event.targets.reduce(
    (acc, target) => acc + (target.lines ?? []).reduce((sum, [a, b]) => sum + (b - a + 1), 0),
    0
  );
  switch (event.action) {
    case "edit":
      if (n === 0) return "Edited";
      return lines > 0 ? `Edited ${files} · ${lines} ${lines === 1 ? "line" : "lines"} touched` : `Edited ${files}`;
    case "read":
      if (n === 0) return "Read";
      return lines > 0 ? `Read ${files} · ${lines} ${lines === 1 ? "line" : "lines"}` : `Read ${files}`;
    case "search":
      return `Searched · ${n === 0 ? "no" : n} ${n === 1 ? "hit" : "hits"}`;
    case "exec":
      return "Ran a command";
    case "verify":
      return "Ran a check";
    default:
      return n > 0 ? `Touched ${files}` : "";
  }
}

/** hand-rolled relative age — "just now" / "3 h ago" / "2 d ago"; coarse on
 * purpose, the wall clock beside it carries the precision */
function relativeAge(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

// the bucket's real first→last extent as "93 s" / "4 min" / "2 h"; a single
// event or an unclocked bucket has no span to speak of
function eventsSpan(events: TraceEvent[]): string | undefined {
  if (events.length < 2) return undefined;
  const a = Date.parse(events[0].ts ?? "");
  const b = Date.parse(events[events.length - 1].ts ?? "");
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return undefined;
  const s = Math.max(1, Math.round((b - a) / 1000));
  if (s < 120) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 120) return `${m} min`;
  return `${Math.round(m / 60)} h`;
}

// the path the bucket kept coming back to; ties break alphabetically so the
// line is stable across re-renders
function busiestPath(events: TraceEvent[]): { path: string; touches: number } | undefined {
  const touches = new Map<string, number>();
  for (const event of events) {
    for (const target of event.targets) {
      if (target.path) touches.set(target.path, (touches.get(target.path) ?? 0) + 1);
    }
  }
  let best: { path: string; touches: number } | undefined;
  for (const [path, count] of touches) {
    if (!best || count > best.touches || (count === best.touches && path < best.path)) {
      best = { path, touches: count };
    }
  }
  return best;
}

// hh:mm:ss span from the events' own clocks; same degrade rules as the
// strip's bucket tooltips — an unclocked bucket reads as an em dash
function eventsRange(events: TraceEvent[]): string {
  const a = events[0]?.ts ? clock(events[0].ts!) : "";
  const b = events[events.length - 1]?.ts ? clock(events[events.length - 1].ts!) : "";
  if (!a && !b) return "—";
  if (!a || !b || a === b) return a || b;
  return `${a} – ${b}`;
}

function linesLabel(ranges: [number, number][]): string {
  return ranges.map(([a, b]) => (a === b ? `L${a}` : `L${a}-${b}`)).join(", ");
}

// a clock alone reads backwards across midnight; add the day when the two
// ends of a window fall on different dates
function dayClock(ts: string, other: string): string {
  const a = new Date(ts);
  const b = new Date(other);
  if (a.toDateString() === b.toDateString()) return clock(ts);
  return `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${clock(ts)}`;
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
