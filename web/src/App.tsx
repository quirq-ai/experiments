import { PanelLeftOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  describeError,
  getAgentTrace,
  getRepoHistory,
  getRepoMap,
  getSessionAgents,
  getSessionReport,
  getSessionSnapshot,
  listSessions,
  startSessionAnalyze
} from "./api/client";
import { Crosshair, Sparkles, Mountain, TreePine, Users } from "lucide-react";
import type { AgentGraph, CityMap, JudgeChoice, ReportStatus, Trace } from "./types";
import { Dock, type PanelDescriptor } from "./ui/Dock";
import { AgentsPanel } from "./ui/AgentsPanel";
import { ReportPanel } from "./ui/ReportPanel";
import { ViewPanel } from "./ui/ViewPanel";
import { PlaybackEngine } from "./playback/reducer";
import { downloadBlob, recordingSupported, recordPlayback } from "./playback/recorder";
import { CityScene } from "./scene/CityScene";
import { TreeScene } from "./scene/TreeScene";
import { effectiveFilters, sessionVisible } from "./state/filters";
import { useConstellationStore } from "./state/constellation";
import { useAppStore } from "./state/store";
import { ConstellationView } from "./ui/ConstellationView";
import { DetailCard, subtreeContent, type CardAnchor, type DetailContent } from "./ui/DetailCard";
import { Hud } from "./ui/Hud";
import { Inspector } from "./ui/Inspector";
import { SessionRail } from "./ui/SessionRail";
import { toggleRailShortcut } from "./ui/shortcuts";
import { Timeline, type TimelineBucket } from "./ui/Timeline";
import "./styles.css";

function evaluateHint(badge: "running" | "done" | "stale" | "failed" | null): string {
  switch (badge) {
    case "running":
      return "The judge is reading the trace — about a minute";
    case "done":
      return "Evaluation ready";
    case "stale":
      return "Evaluation ready, but the session has grown since";
    case "failed":
      return "The last evaluation failed — open to retry";
    default:
      return "Evaluate this session with your local agent CLI";
  }
}

const MAIN_ACTOR_KEY = "__main__";

// the EVENT card's content for one event of a trace; a synthesized git
// history (harness "git") tags it with the repo so the card can fetch the
// commit's diff lazily — the repo is the trace's cwd by the history contract
function eventDetail(trace: Trace, event: Trace["events"][number]): DetailContent {
  const git =
    trace.session.harness === "git" && trace.session.cwd
      ? { repo: trace.session.cwd }
      : undefined;
  return { kind: "event", event, total: trace.events.length, git };
}

export default function App() {
  const {
    sessions,
    activeSessionKey,
    trace,
    city,
    currentSeq,
    selectedPath,
    view,
    loading,
    error,
    hideEmpty,
    harnessFilter,
    folderFilter,
    groupByFolder,
    railCollapsed,
    mapOnly,
    setView,
    setSessions,
    setActiveSession,
    setData,
    setCityOnly,
    setCurrentSeq,
    setSelectedPath,
    setLoading,
    setError,
    setHideEmpty,
    setHarnessFilter,
    setFolderFilter,
    setGroupByFolder,
    setRailCollapsed
  } = useAppStore();
  const urlSessionConsumed = useRef(false);
  const scanGeneration = useRef(0);
  const loadGeneration = useRef(0);
  const lensGeneration = useRef(0);
  const agentGraphRequest = useRef(0);
  const agentTraceRequest = useRef(0);
  const manualRefreshInFlight = useRef(false);
  const pendingLoads = useRef(0);
  const activeSessionKeyRef = useRef(activeSessionKey);
  activeSessionKeyRef.current = activeSessionKey;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [openSheet, setOpenSheet] = useState<string | null>(null);
  const [openPop, setOpenPop] = useState<string | null>(null);
  // the walk view's ONE detail-card slot: a line click (arc, bucket, branch)
  // fills it, a second click replaces it, dismissal empties it. Scene-origin
  // cards (arc, branch) carry no anchor — they mount inside the viewport and
  // the scene itself moves them with the pinned object; bucket cards anchor
  // on the clicked bar
  const [card, setCard] = useState<{ content: DetailContent; anchor?: CardAnchor } | null>(null);
  // a world-anchored card hands its element to the mounted scene through this
  // ref; the scene projects the pin and positions it every rendered frame
  const sceneCardRef = useRef<HTMLElement | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus | undefined>();
  const [agentGraph, setAgentGraph] = useState<AgentGraph | undefined>();
  const [activeAgentID, setActiveAgentID] = useState<string | null>(null);
  const [agentGraphLoading, setAgentGraphLoading] = useState(false);
  const [loadingAgentID, setLoadingAgentID] = useState<string | undefined>();
  const [agentPanelError, setAgentPanelError] = useState<string | undefined>();
  const [agentRetryID, setAgentRetryID] = useState<string | null | undefined>();
  const activeAgentIDRef = useRef<string | null>(null);
  const pendingAgentIDRef = useRef<string | undefined>(undefined);
  const rootTraceRef = useRef<Trace | undefined>(undefined);
  const rootCityRef = useRef<CityMap | undefined>(undefined);
  const actorTraceCache = useRef(new Map<string, Trace>());
  const actorPlayheads = useRef(new Map<string, number>());
  const exportingRef = useRef(false);
  exportingRef.current = exporting;
  const constellationOpen = useConstellationStore((s) => s.open);

  // scenes hand up their live <canvas> so the video exporter can capture it;
  // stable identity keeps the scene mount effect from remounting on every render
  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  }, []);

  const beginLoading = useCallback(() => {
    pendingLoads.current++;
    setLoading(true);
  }, [setLoading]);

  const endLoading = useCallback(() => {
    pendingLoads.current = Math.max(0, pendingLoads.current - 1);
    if (pendingLoads.current === 0) setLoading(false);
  }, [setLoading]);

  const resetLens = useCallback(() => {
    const generation = ++lensGeneration.current;
    agentGraphRequest.current++;
    agentTraceRequest.current++;
    activeAgentIDRef.current = null;
    pendingAgentIDRef.current = undefined;
    rootTraceRef.current = undefined;
    rootCityRef.current = undefined;
    actorTraceCache.current.clear();
    actorPlayheads.current.clear();
    setAgentGraph(undefined);
    setActiveAgentID(null);
    setAgentGraphLoading(false);
    setLoadingAgentID(undefined);
    setAgentPanelError(undefined);
    setAgentRetryID(undefined);
    return generation;
  }, []);

  const loadAgentGraph = useCallback(async (key: string, generation = lensGeneration.current) => {
    const request = ++agentGraphRequest.current;
    setAgentGraphLoading(true);
    setAgentPanelError(undefined);
    setAgentRetryID(undefined);
    try {
      const graph = await getSessionAgents(key);
      if (
        generation !== lensGeneration.current ||
        request !== agentGraphRequest.current ||
        activeSessionKeyRef.current !== key
      ) {
        return;
      }
      setAgentGraph(graph);
    } catch (err) {
      if (
        generation === lensGeneration.current &&
        request === agentGraphRequest.current &&
        activeSessionKeyRef.current === key
      ) {
        setAgentPanelError(describeError(err, "loading agents"));
        setAgentRetryID(null);
      }
    } finally {
      if (
        generation === lensGeneration.current &&
        request === agentGraphRequest.current &&
        activeSessionKeyRef.current === key
      ) {
        setAgentGraphLoading(false);
      }
    }
  }, []);

  const loadSession = useCallback(async (key: string) => {
    const generation = ++loadGeneration.current;
    const currentLensGeneration = lensGeneration.current;
    beginLoading();
    setError(undefined);
    try {
      const { trace: nextTrace, city: nextCity } = await getSessionSnapshot(key);
      if (
        generation !== loadGeneration.current ||
        currentLensGeneration !== lensGeneration.current ||
        activeSessionKeyRef.current !== key
      ) {
        return;
      }
      rootTraceRef.current = nextTrace;
      rootCityRef.current = nextCity;
      actorTraceCache.current.set(MAIN_ACTOR_KEY, nextTrace);
      const activeChildID = activeAgentIDRef.current;
      if (activeChildID === null) {
        setData(nextTrace, nextCity);
        const remembered = actorPlayheads.current.get(MAIN_ACTOR_KEY);
        if (remembered !== undefined) {
          setCurrentSeq(Math.min(remembered, Math.max(0, nextTrace.events.length - 1)));
        }
        setSelectedPath(undefined);
      } else {
        const childTrace = actorTraceCache.current.get(activeChildID);
        if (childTrace) {
          const seq = useAppStore.getState().currentSeq;
          setData(childTrace, nextCity);
          setCurrentSeq(Math.min(seq, Math.max(0, childTrace.events.length - 1)));
        }
      }
    } catch (err) {
      if (generation === loadGeneration.current && activeSessionKeyRef.current === key) {
        setError(describeError(err, "loading the session"));
      }
    } finally {
      endLoading();
    }
  }, [beginLoading, endLoading, setCurrentSeq, setData, setError, setSelectedPath]);

  const invalidateActorTracesForRescan = useCallback(() => {
    const activeActorID = activeAgentIDRef.current;
    actorPlayheads.current.set(
      activeActorID ?? MAIN_ACTOR_KEY,
      useAppStore.getState().currentSeq
    );
    agentTraceRequest.current++;
    pendingAgentIDRef.current = undefined;
    actorTraceCache.current.clear();
    activeAgentIDRef.current = null;
    setActiveAgentID(null);
    setLoadingAgentID(undefined);
    setAgentPanelError(undefined);
    setAgentRetryID(undefined);

    const rootTrace = rootTraceRef.current;
    const rootCity = rootCityRef.current;
    if (rootTrace && rootCity) {
      setData(rootTrace, rootCity);
      const remembered = actorPlayheads.current.get(MAIN_ACTOR_KEY);
      if (remembered !== undefined) {
        setCurrentSeq(Math.min(remembered, Math.max(0, rootTrace.events.length - 1)));
      }
      setSelectedPath(undefined);
    }
  }, [setCurrentSeq, setData, setSelectedPath]);

  const scan = useCallback(async (fresh: boolean) => {
    const generation = ++scanGeneration.current;
    beginLoading();
    setError(undefined);
    try {
      const data = await listSessions(fresh);
      if (generation !== scanGeneration.current) return;
      setSessions(data);
      let preferred: string | undefined;
      if (!urlSessionConsumed.current) {
        urlSessionConsumed.current = true;
        const selector = new URL(window.location.href).searchParams.get("session") ?? undefined;
        const exact = selector ? data.find((session) => session.key === selector) : undefined;
        const legacyMatches = selector && !exact ? data.filter((session) => session.id === selector) : [];
        const fromUrl = exact?.key ?? (legacyMatches.length === 1 ? legacyMatches[0].key : undefined);
        if (fromUrl) {
          preferred = fromUrl;
        } else if (legacyMatches.length > 1) {
          console.warn(`session id "${selector}" is ambiguous; falling back to the latest session`);
        } else if (selector) {
          console.warn(`session "${selector}" not found; falling back to the latest session`);
        }
      }
      // a session can disappear between scans; fall back instead of pinning a dead key
      const currentActiveKey = activeSessionKeyRef.current;
      const stillListed =
        currentActiveKey !== undefined && data.some((session) => session.key === currentActiveKey);
      // prefer a session the rail will actually show; if the filters hide
      // everything, the newest session still beats a blank stage
      const listFilters = effectiveFilters(data, { hideEmpty, harness: harnessFilter, folder: folderFilter });
      const fallback = (data.find((session) => sessionVisible(session, listFilters)) ?? data[0])?.key;
      const next = preferred ?? (stillListed ? currentActiveKey : fallback);
      if (next !== currentActiveKey) {
        const lens = resetLens();
        activeSessionKeyRef.current = next;
        if (!next) loadGeneration.current++;
        setActiveSession(next);
        if (next) void loadAgentGraph(next, lens);
      } else if (fresh && next) {
        invalidateActorTracesForRescan();
        void loadAgentGraph(next);
      }
      if (next) await loadSession(next);
    } catch (err) {
      if (generation === scanGeneration.current) {
        setError(describeError(err, "scanning sessions"));
      }
    } finally {
      endLoading();
    }
  }, [beginLoading, endLoading, folderFilter, harnessFilter, hideEmpty, invalidateActorTracesForRescan, loadAgentGraph, loadSession, resetLens, setActiveSession, setError, setSessions]);

  // map-history mode: the repo's commit log arrives as a synthesized trace
  // (harness "git", one event per commit) and takes the NORMAL playback
  // plumbing — deck, engine, touch glow, trail arcs, cards — over the
  // map-only city. setData never touches mapOnly, so the LOC heights stay:
  // the world stays sized by code, the history lights it. A 404 means "not a
  // git repo" — the static map stays exactly as it was, no deck, no toast.
  const loadRepoHistory = useCallback(async (city: CityMap) => {
    try {
      const history = await getRepoHistory(city.repo.root);
      const state = useAppStore.getState();
      if (!state.mapOnly || state.city !== city) return;
      if (history.events.length === 0) return;
      // the history endpoint synthesizes its trace without a citymap, so its
      // stats carry filesInRepo 0 — fill it from the city in hand, or the
      // HUD's "N files" chip and unvisited tally would read 0 in this mode
      const trace =
        history.stats.filesInRepo === 0
          ? { ...history, stats: { ...history.stats, filesInRepo: city.files.length } }
          : history;
      setData(trace, city);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return;
      setError(describeError(err, "loading the git history"));
    }
  }, [setData, setError]);

  const loadRepoMap = useCallback(async (repo?: string) => {
    beginLoading();
    setError(undefined);
    try {
      const city = await getRepoMap(repo);
      setCityOnly(city);
      // non-blocking on purpose: the static map is already up; the deck
      // appears when (and only if) the repo's history lands
      void loadRepoHistory(city);
    } catch (err) {
      setError(describeError(err, "loading the repository map"));
    } finally {
      endLoading();
    }
  }, [beginLoading, endLoading, loadRepoHistory, setCityOnly, setError]);

  // open the static map for a repo in a new tab so the running session stays put
  const openMap = useCallback((repo?: string) => {
    const url = repo ? `/?map=1&repo=${encodeURIComponent(repo)}` : "/?map=1";
    window.open(url, "_blank", "noopener");
  }, []);

  const selectSession = useCallback((key: string) => {
    if (activeSessionKeyRef.current === key) return;
    const lens = resetLens();
    activeSessionKeyRef.current = key;
    setActiveSession(key);
    void loadAgentGraph(key, lens);
    void loadSession(key);
  }, [loadAgentGraph, loadSession, resetLens, setActiveSession]);

  // a constellation lane's "open" hands off its exact moment: close the view,
  // run the normal session-open path, then land the playhead on the lane's seq
  const openFromConstellation = useCallback((key: string, seq: number) => {
    useConstellationStore.getState().setOpen(false);
    if (activeSessionKeyRef.current === key) {
      setCurrentSeq(seq);
      return;
    }
    const lens = resetLens();
    activeSessionKeyRef.current = key;
    setActiveSession(key);
    void loadAgentGraph(key, lens);
    void loadSession(key).then(() => {
      if (activeSessionKeyRef.current !== key) return;
      const len = rootTraceRef.current?.events.length ?? 0;
      setCurrentSeq(Math.min(seq, Math.max(0, len - 1)));
    });
  }, [loadAgentGraph, loadSession, resetLens, setActiveSession, setCurrentSeq]);

  // stable identity keeps SessionRail's memo effective; inert while an export
  // records because closing the constellation would remount the scene canvas
  const toggleConstellation = useCallback(() => {
    if (exportingRef.current) return;
    const store = useConstellationStore.getState();
    store.setOpen(!store.open);
  }, []);

  const saveActivePlayhead = useCallback(() => {
    const key = activeAgentIDRef.current ?? MAIN_ACTOR_KEY;
    actorPlayheads.current.set(key, useAppStore.getState().currentSeq);
  }, []);

  const showCachedActor = useCallback((agentID: string | null, nextTrace: Trace, nextCity: CityMap) => {
    saveActivePlayhead();
    activeAgentIDRef.current = agentID;
    setActiveAgentID(agentID);
    setData(nextTrace, nextCity);
    const remembered = actorPlayheads.current.get(agentID ?? MAIN_ACTOR_KEY);
    if (remembered !== undefined) {
      setCurrentSeq(Math.min(remembered, Math.max(0, nextTrace.events.length - 1)));
    }
    setSelectedPath(undefined);
  }, [saveActivePlayhead, setCurrentSeq, setData, setSelectedPath]);

  const selectAgent = useCallback(async (agentID: string | null) => {
    if (exportingRef.current) return;
    const rootKey = activeSessionKeyRef.current;
    const nextCity = rootCityRef.current;
    if (!rootKey || !nextCity) return;

    const request = ++agentTraceRequest.current;
    pendingAgentIDRef.current = undefined;
    setLoadingAgentID(undefined);
    setAgentPanelError(undefined);
    setAgentRetryID(undefined);

    if (activeAgentIDRef.current === agentID) return;

    const cachedTrace =
      agentID === null ? rootTraceRef.current : actorTraceCache.current.get(agentID);
    if (cachedTrace) {
      showCachedActor(agentID, cachedTrace, nextCity);
      return;
    }
    if (agentID === null) return;

    const node = agentGraph?.agents.find((agent) => agent.id === agentID);
    if (!node || node.traceAvailability !== "available") return;

    const generation = lensGeneration.current;
    pendingAgentIDRef.current = agentID;
    setLoadingAgentID(agentID);
    try {
      const nextTrace = await getAgentTrace(rootKey, agentID);
      if (
        generation !== lensGeneration.current ||
        request !== agentTraceRequest.current ||
        pendingAgentIDRef.current !== agentID ||
        activeSessionKeyRef.current !== rootKey ||
        exportingRef.current
      ) {
        return;
      }
      actorTraceCache.current.set(agentID, nextTrace);
      showCachedActor(agentID, nextTrace, rootCityRef.current ?? nextCity);
    } catch (err) {
      if (
        generation === lensGeneration.current &&
        request === agentTraceRequest.current &&
        pendingAgentIDRef.current === agentID &&
        activeSessionKeyRef.current === rootKey
      ) {
        setAgentPanelError(describeError(err, `loading the ${node.label} trace`));
        setAgentRetryID(agentID);
      }
    } finally {
      if (
        generation === lensGeneration.current &&
        request === agentTraceRequest.current &&
        pendingAgentIDRef.current === agentID &&
        activeSessionKeyRef.current === rootKey
      ) {
        pendingAgentIDRef.current = undefined;
        setLoadingAgentID(undefined);
      }
    }
  }, [agentGraph, showCachedActor]);

  const retryAgents = useCallback(() => {
    const key = activeSessionKeyRef.current;
    if (exportingRef.current || !key || agentRetryID === undefined) return;
    if (agentRetryID === null) void loadAgentGraph(key);
    else void selectAgent(agentRetryID);
  }, [agentRetryID, loadAgentGraph, selectAgent]);

  const exportVideo = useCallback(async () => {
    const canvas = canvasRef.current;
    const total = trace?.events.length ?? 0;
    if (!canvas || total === 0 || exportingRef.current) return;
    // the recorder owns the playhead for the duration of the export; setting
    // exporting=true locks the transport, scrubber, session rail, and view
    // toggle (see the `exporting` prop threaded into Timeline/SessionRail/Hud)
    // so nothing else moves the playhead or swaps the canvas mid-recording
    const exportSessionKey = activeSessionKeyRef.current;
    const exportActorID = activeAgentIDRef.current;
    const resumeSeq = useAppStore.getState().currentSeq;
    agentTraceRequest.current++;
    pendingAgentIDRef.current = undefined;
    setLoadingAgentID(undefined);
    exportingRef.current = true;
    setExporting(true);
    setError(undefined);
    try {
      const { blob, extension } = await recordPlayback({
        canvas,
        total,
        setSeq: setCurrentSeq
      });
      const name = trace?.session.id || exportSessionKey || "session";
      downloadBlob(blob, `spacewalk-${name}.${extension}`);
    } catch (err) {
      setError(describeError(err, "exporting the video"));
    } finally {
      // only restore the playhead if we're still on the same session and actor —
      // a guard in case a switch slipped through; normally the UI lock prevents it
      if (
        activeSessionKeyRef.current === exportSessionKey &&
        activeAgentIDRef.current === exportActorID
      ) {
        setCurrentSeq(resumeSeq);
      }
      exportingRef.current = false;
      setExporting(false);
    }
  }, [trace, exporting, setCurrentSeq, setError]);

  // stable callbacks keep SessionRail's memo effective across playback ticks
  const collapseRail = useCallback(() => setRailCollapsed(true), [setRailCollapsed]);
  const expandRail = useCallback(() => setRailCollapsed(false), [setRailCollapsed]);

  // --- session evaluation: fetched on session switch, polled while the judge
  // runs; the judge itself only ever starts from the explicit button press
  const refreshReport = useCallback(async (key: string) => {
    try {
      const status = await getSessionReport(key);
      if (activeSessionKeyRef.current === key) setReportStatus(status);
    } catch {
      // not worth a toast: the status stays undefined, the panel keeps its
      // "checking" state, and the unknown-status retry effect below tries
      // again until the server answers
    }
  }, []);

  useEffect(() => {
    setOpenSheet(null);
    setOpenPop(null);
    setReportStatus(undefined);
    if (activeSessionKey && !mapOnly) void refreshReport(activeSessionKey);
  }, [activeSessionKey, mapOnly, refreshReport]);

  // refreshes the rail's evaluation badges without disturbing selection —
  // scan() owns selection fallback, this only swaps the list data
  const refreshSessionList = useCallback(async () => {
    try {
      setSessions(await listSessions());
    } catch {
      // badge refresh is best-effort; the next scan will catch up
    }
  }, [setSessions]);

  // manual rescan: the active key usually survives it, so the report status
  // must be refetched explicitly — it may have gone stale or finished while
  // we weren't polling
  const refresh = useCallback(() => {
    if (exportingRef.current || manualRefreshInFlight.current) return;
    manualRefreshInFlight.current = true;
    const key = activeSessionKeyRef.current;
    if (key && !mapOnly) void refreshReport(key);
    void scan(true).finally(() => {
      manualRefreshInFlight.current = false;
    });
  }, [scan, refreshReport, mapOnly]);

  useEffect(() => {
    if (reportStatus?.state !== "running" || !activeSessionKey) return;
    const timer = setInterval(() => {
      void refreshReport(activeSessionKey);
      void refreshSessionList();
    }, 2500);
    return () => {
      clearInterval(timer);
      // one more list pass so the rail badge leaves "evaluating" promptly
      void refreshSessionList();
    };
  }, [reportStatus?.state, activeSessionKey, refreshReport, refreshSessionList]);

  // while the report status is unknown (first request failed or still on its
  // way), keep asking — otherwise a single dropped request would pin the
  // panel to "checking" until a session switch or reload
  useEffect(() => {
    if (reportStatus !== undefined || !activeSessionKey || mapOnly) return;
    const timer = setInterval(() => void refreshReport(activeSessionKey), 5000);
    return () => clearInterval(timer);
  }, [reportStatus === undefined, activeSessionKey, mapOnly, refreshReport]);

  // a judge can be running for a session other than the active one; keep the
  // rail badges honest by polling the list until every run finishes (the
  // running-state effect above already polls while the active session runs)
  const anyEvaluating = useMemo(() => sessions.some((s) => s.reportState === "running"), [sessions]);
  useEffect(() => {
    if (!anyEvaluating || reportStatus?.state === "running") return;
    const timer = setInterval(() => void refreshSessionList(), 5000);
    return () => clearInterval(timer);
  }, [anyEvaluating, reportStatus?.state, refreshSessionList]);

  const analyzeSession = useCallback(async (choice: JudgeChoice) => {
    const key = activeSessionKeyRef.current;
    if (!key) return;
    try {
      const status = await startSessionAnalyze(key, choice);
      if (activeSessionKeyRef.current === key) setReportStatus(status);
      void refreshSessionList();
    } catch (err) {
      setError(describeError(err, "starting the evaluation"));
    }
  }, [setError, refreshSessionList]);

  // selecting a file in the scene opens the inspect sheet; deselecting keeps
  // whatever panel the user had open
  const selectFile = useCallback(
    (path: string | undefined) => {
      setSelectedPath(path);
      if (path) setOpenSheet("inspect");
    },
    [setSelectedPath]
  );

  // a clicked trail arc names an exact event: land the playhead there and
  // select the arc's file so scene, strip, and inspector agree on the moment.
  // Inert while an export owns the playhead, like the deck transport.
  // The jump/select stays exactly as it was; the EVENT card is additive and
  // anchorless — the scene pinned the arc and keeps the card beside it.
  const handleTrailClick = useCallback(
    (seq: number, path?: string) => {
      if (exportingRef.current) return;
      setCurrentSeq(seq);
      setSelectedPath(path);
      const currentTrace = useAppStore.getState().trace;
      const event = currentTrace?.events[seq];
      if (currentTrace && event) {
        setCard({ content: eventDetail(currentTrace, event) });
      }
    },
    [setCurrentSeq, setSelectedPath]
  );

  // a still strip-bar click already jumped the playhead (Timeline owns that);
  // here the same click opens the BUCKET card, whose rows jump to exact events
  const handleBucketClick = useCallback(
    (bucket: TimelineBucket, anchor: { x: number; y: number }) => {
      const currentTrace = useAppStore.getState().trace;
      if (!currentTrace) return;
      // a git-history bar that names exactly ONE commit opens the EVENT card
      // — its subject and diff — instead of a one-row bucket list; histories
      // longer than the strip keep the bucket card and its per-commit rows
      if (currentTrace.session.harness === "git" && bucket.to - bucket.from === 1) {
        const event = currentTrace.events[bucket.from];
        if (event) {
          setCard({ content: eventDetail(currentTrace, event), anchor });
          return;
        }
      }
      setCard({
        content: {
          kind: "bucket",
          events: currentTrace.events.slice(bucket.from, bucket.to),
          onJumpTo: (seq: number) => {
            if (!exportingRef.current) setCurrentSeq(seq);
          }
        },
        anchor
      });
    },
    [setCurrentSeq]
  );

  const closeCard = useCallback(() => setCard(null), []);

  // a card names events/folders of ONE trace on ONE stage: session or lens
  // switches, the constellation opening, and a scene swap (V) all invalidate
  // it — a remounted scene has no pin left to keep a world-anchored card true
  useEffect(() => {
    setCard(null);
  }, [trace, constellationOpen, view]);

  const closeSheet = useCallback(() => setOpenSheet(null), []);
  const closePop = useCallback(() => setOpenPop(null), []);
  const openAgents = useCallback(() => {
    if (!exportingRef.current) setOpenSheet("agents");
  }, []);

  // sheets are exclusive (one full-height paper at a time); pops toggle
  // independently so a view tweak never steals the open report
  const togglePanel = useCallback((panel: PanelDescriptor) => {
    if (panel.presentation === "sheet") {
      setOpenSheet((current) => (current === panel.id ? null : panel.id));
    } else {
      setOpenPop((current) => (current === panel.id ? null : panel.id));
    }
  }, []);

  // a finding jump moves the playhead and focuses the evidence's file so the
  // claim is visible in the scene, not just in the panel — without stealing
  // the dock away from the evaluation tab
  const jumpToEvidence = useCallback(
    (seq: number) => {
      if (exportingRef.current) return;
      const rootTrace = rootTraceRef.current;
      const rootCity = rootCityRef.current;
      if (!rootTrace || !rootCity) return;
      agentTraceRequest.current++;
      pendingAgentIDRef.current = undefined;
      setLoadingAgentID(undefined);
      if (activeAgentIDRef.current !== null) {
        saveActivePlayhead();
        activeAgentIDRef.current = null;
        setActiveAgentID(null);
        setData(rootTrace, rootCity);
      }
      setCurrentSeq(seq);
      actorPlayheads.current.set(MAIN_ACTOR_KEY, seq);
      const event = rootTrace.events[seq];
      const path = event?.targets.find((target) => target.path)?.path;
      setSelectedPath(path);
    },
    [saveActivePlayhead, setCurrentSeq, setData, setSelectedPath]
  );

  const openAgentsAtMark = useCallback((seq: number) => {
    setCurrentSeq(seq);
    setOpenSheet("agents");
  }, [setCurrentSeq]);

  const jumpToHistory = useCallback((seq: number) => {
    if (exportingRef.current) return;
    setCurrentSeq(seq);
  }, [setCurrentSeq]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "b" || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      const store = useAppStore.getState();
      store.setRailCollapsed(!store.railCollapsed);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // V cycles the scene view without opening the view pop; locked during
  // export because switching scenes would swap the recorded canvas
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "v" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (exportingRef.current) return;
      const store = useAppStore.getState();
      store.setView(store.view === "tree" ? "terrain" : "tree");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    if (params.get("map") === "1") {
      void loadRepoMap(params.get("repo") ?? undefined);
    } else {
      void scan(false);
      // deep link mirrors ?map=1: land directly on the constellation;
      // ?constellation=one|world land on the shared-map union layouts
      const constellation = params.get("constellation");
      if (constellation === "1" || constellation === "one" || constellation === "world") {
        const store = useConstellationStore.getState();
        if (constellation === "one" || constellation === "world") store.setLayout(constellation);
        store.setOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reportBadge = useMemo(() => {
    if (reportStatus?.state === "running") return "running" as const;
    if (reportStatus?.state === "failed") return "failed" as const;
    if (reportStatus?.state === "done") return reportStatus.stale ? ("stale" as const) : ("done" as const);
    return null;
  }, [reportStatus]);

  const agentLabel = useMemo(() => {
    if (activeAgentID === null) return "Main";
    return agentGraph?.agents.find((agent) => agent.id === activeAgentID)?.label ?? "Subagent";
  }, [activeAgentID, agentGraph]);

  // map-history keeps the LOC heights even with a trace (locHeights stays on
  // in map mode), so the terrain note must not promise attention heights there
  const viewNote =
    view === "tree"
      ? trace
        ? "glow ∝ revisits"
        : "static map"
      : trace && !mapOnly
        ? "height ∝ depth × revisits"
        : "height ∝ lines";

  const engine = useMemo(() => new PlaybackEngine(trace, city), [trace, city]);
  const playback = useMemo(() => engine.snapshotAt(currentSeq), [engine, currentSeq]);

  // a clicked branch/district names a folder: the scene's camera fly already
  // happened; the SUBTREE card adds the folder's numbers at this playhead,
  // anchorless because the scene pinned the branch and tracks it.
  // Lives below the playback memo it closes over; scenes read it via a ref,
  // so its changing identity never remounts them.
  const handleRegionClick = useCallback(
    (path: string) => {
      if (!city) return;
      setCard({ content: subtreeContent(path, city, playback, setSelectedPath) });
    },
    [city, playback, setSelectedPath]
  );
  // live tallies for the HUD spectrum; touchByPath mirrors the backend stats scope
  const touchCounts = useMemo(() => {
    let edited = 0;
    let read = 0;
    let seen = 0;
    for (const touch of playback.touchByPath.values()) {
      if (touch === "edit") edited++;
      else if (touch === "read") read++;
      else seen++;
    }
    return { edited, read, seen };
  }, [playback]);
  const selectedFile = useMemo(
    () => (selectedPath ? city?.files.find((file) => file.path === selectedPath) : undefined),
    [city, selectedPath]
  );
  // mirrors the backend churn definition (stats.churnFiles): per path, the
  // number of events that carried an edit touch; churn means three or more
  const churn = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of trace?.events ?? []) {
      for (const target of event.targets) {
        if (target.touch === "edit" && target.path) {
          counts.set(target.path, (counts.get(target.path) ?? 0) + 1);
        }
      }
    }
    return [...counts.entries()]
      .filter(([, edits]) => edits >= 3)
      .map(([path, edits]) => ({ path, edits }))
      .sort((a, b) => b.edits - a.edits || (a.path < b.path ? -1 : 1));
  }, [trace]);

  return (
    <main className={mapOnly ? "app-frame rail-collapsed" : railCollapsed ? "app-frame rail-collapsed" : "app-frame"}>
      {mapOnly ? null : (
        <SessionRail
          sessions={sessions}
          activeKey={activeSessionKey}
          loading={loading}
          hideEmpty={hideEmpty}
          harnessFilter={harnessFilter}
          folderFilter={folderFilter}
          groupByFolder={groupByFolder}
          collapsed={railCollapsed}
          onSelect={selectSession}
          onRefresh={refresh}
          onHideEmptyChange={setHideEmpty}
          onHarnessFilterChange={setHarnessFilter}
          onFolderFilterChange={setFolderFilter}
          onGroupByFolderChange={setGroupByFolder}
          onCollapse={collapseRail}
          onOpenMap={openMap}
          onOpenConstellation={toggleConstellation}
          activeRepo={trace?.session.cwd}
          locked={exporting}
          activeReportState={reportStatus === undefined ? undefined : reportBadge}
        />
      )}
      <section className="stage">
        {constellationOpen && !mapOnly ? (
          <ConstellationView sessions={sessions} onOpenSession={openFromConstellation} />
        ) : (
          <>
            <div className="viewport">
              {!mapOnly && railCollapsed ? (
                <button
                  className="rail-expand"
                  onClick={expandRail}
                  title={`Show sidebar (${toggleRailShortcut})`}
                  aria-label="Show session sidebar"
                >
                  <PanelLeftOpen size={15} />
                </button>
              ) : null}
              {view === "tree" ? (
                <TreeScene
                  city={city}
                  playback={playback}
                  selectedPath={selectedPath}
                  onSelect={selectFile}
                  onCanvasReady={handleCanvasReady}
                  onTrailClick={handleTrailClick}
                  onRegionClick={handleRegionClick}
                  anchorElRef={sceneCardRef}
                  onPinCleared={closeCard}
                />
              ) : (
                <CityScene
                  city={city}
                  playback={playback}
                  selectedPath={selectedPath}
                  onSelect={selectFile}
                  onCanvasReady={handleCanvasReady}
                  locHeights={mapOnly}
                  onTrailClick={handleTrailClick}
                  onRegionClick={handleRegionClick}
                  anchorElRef={sceneCardRef}
                  onPinCleared={closeCard}
                />
              )}
              {/* the scene-origin card lives INSIDE the viewport (the scene
                  host's coordinate space) so the scene can keep it beside the
                  pinned arc/branch through orbit, damping, and fly-tos */}
              {card && !card.anchor ? (
                <DetailCard content={card.content} anchorElRef={sceneCardRef} onClose={closeCard} />
              ) : null}
              <Hud
                trace={trace}
                city={city}
                // map mode has no agent lenses — a git-history trace must not
                // grow the HUD a dead Lens button
                agentLabel={mapOnly ? undefined : agentLabel}
                editedNow={touchCounts.edited}
                readNow={touchCounts.read}
                seenNow={touchCounts.seen}
                churn={churn}
                onSelectFile={selectFile}
                onOpenAgents={!mapOnly && trace ? openAgents : undefined}
                locked={exporting}
              />
              {city ? (
                <Dock
                  panels={[
                    {
                      id: "view",
                      icon: view === "tree" ? TreePine : Mountain,
                      hint: `Scene view: ${view} — click to change, or press V`,
                      section: "scene",
                      presentation: "pop",
                      render: () => (
                        <ViewPanel view={view} onViewChange={setView} note={viewNote} locked={exporting} />
                      )
                    },
                    {
                      id: "inspect",
                      icon: Crosshair,
                      hint: "Inspect the selected file",
                      section: "session",
                      presentation: "sheet",
                      render: () => (
                        <Inspector
                          file={selectedFile}
                          touch={selectedFile ? playback.touchByPath.get(selectedFile.path) : undefined}
                          history={selectedFile ? (playback.historyByPath.get(selectedFile.path) ?? []) : []}
                          onClose={closeSheet}
                          onJumpTo={jumpToHistory}
                          locked={exporting}
                        />
                      )
                    },
                    ...(!mapOnly && trace
                      ? [
                          {
                            id: "agents",
                            icon: Users,
                            hint: `Agent lenses — current: ${agentLabel}`,
                            section: "session",
                            presentation: "sheet",
                            render: () => (
                              <AgentsPanel
                                graph={agentGraph}
                                current={activeAgentID}
                                loading={agentGraphLoading}
                                loadingAgentID={loadingAgentID}
                                locked={exporting}
                                error={agentPanelError}
                                retryAgentID={agentRetryID}
                                onSelect={(agentID) => void selectAgent(agentID)}
                                onRetry={retryAgents}
                                onClose={closeSheet}
                              />
                            )
                          } satisfies PanelDescriptor
                        ]
                      : []),
                    ...(!mapOnly && trace
                      ? [
                          {
                            id: "evaluate",
                            icon: Sparkles,
                            hint: evaluateHint(reportBadge),
                            section: "session",
                            presentation: "sheet",
                            badge: reportBadge,
                            render: () => (
                              <ReportPanel
                                status={reportStatus}
                                analyzing={reportStatus?.state === "running"}
                                locked={exporting}
                                onAnalyze={(choice) => void analyzeSession(choice)}
                                onClose={closeSheet}
                                onJumpTo={jumpToEvidence}
                              />
                            )
                          } satisfies PanelDescriptor
                        ]
                      : [])
                  ]}
                  openSheet={openSheet}
                  openPop={openPop}
                  onToggle={togglePanel}
                  onClosePop={closePop}
                />
              ) : null}
              {!mapOnly && !loading && sessions.length === 0 ? (
                <div className="empty-stage">
                  <div className="card">
                    <h2>No sessions found</h2>
                    <p>
                      Space Walk scans <code>~/.claude/projects</code>, <code>~/.codex/sessions</code>, and{" "}
                      <code>~/.pi/agent/sessions</code> for agent traces. Run a session there, then refresh.
                    </p>
                  </div>
                </div>
              ) : null}
              {loading ? (
                <div className="toast">{mapOnly ? "Building the map…" : sessions.length === 0 ? "Scanning sessions…" : "Reading trace…"}</div>
              ) : null}
              {error ? <div className="toast error">{error}</div> : null}
            </div>
            <Timeline
              trace={trace}
              currentSeq={currentSeq}
              onChange={setCurrentSeq}
              onExport={recordingSupported() ? exportVideo : undefined}
              exporting={exporting}
              onSubagentMark={openAgentsAtMark}
              onBucketClick={handleBucketClick}
            />
            {/* the bucket card is DOM-anchored: it points at its strip bar */}
            {card?.anchor ? <DetailCard content={card.content} anchor={card.anchor} onClose={closeCard} /> : null}
          </>
        )}
      </section>
    </main>
  );
}
