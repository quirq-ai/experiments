import { Eye, EyeOff, FolderOpen, Layers, ListFilter, PanelLeftClose, RefreshCw, Rows3, Search } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { effectiveFilters, sessionVisible } from "../state/filters";
import { folderOptions, groupSessions, sessionFolder } from "../state/folders";
import { LogoMark } from "./LogoMark";
import { toggleRailShortcut } from "./shortcuts";
import type { FolderOption } from "../state/folders";
import type { SessionMeta } from "../types";

interface SessionRailProps {
  sessions: SessionMeta[];
  activeKey?: string;
  loading: boolean;
  hideEmpty: boolean;
  harnessFilter?: string;
  folderFilter?: string;
  /** flat list vs folder-sectioned list; a view preference, not a filter */
  groupByFolder: boolean;
  collapsed: boolean;
  onSelect: (key: string) => void;
  onRefresh: () => void;
  onHideEmptyChange: (hide: boolean) => void;
  onHarnessFilterChange: (harness?: string) => void;
  onFolderFilterChange: (folder?: string) => void;
  onGroupByFolderChange: (group: boolean) => void;
  onCollapse: () => void;
  // opens the static full-repo map for a repo path in a new tab
  onOpenMap: (repo: string) => void;
  // toggles the constellation: every session replaying on one shared clock
  onOpenConstellation?: () => void;
  // the active session's repo, offered as the popover's one-click choice
  activeRepo?: string;
  // while a video export records, session switching is locked so it can't swap
  // the canvas or playhead out from under the recorder
  locked?: boolean;
  // the panel's authoritative (digest-based) status for the active session;
  // undefined = unknown (keep the list's approximate badge), null = no report
  activeReportState?: "running" | "done" | "stale" | "failed" | null;
}

// memo: the app re-renders every playback tick; the rail's props only change
// on scans, session switches, and filter changes
export const SessionRail = memo(function SessionRail({
  sessions,
  activeKey,
  loading,
  hideEmpty,
  harnessFilter,
  folderFilter,
  groupByFolder,
  collapsed,
  onSelect,
  onRefresh,
  onHideEmptyChange,
  onHarnessFilterChange,
  onFolderFilterChange,
  onGroupByFolderChange,
  onCollapse,
  onOpenMap,
  onOpenConstellation,
  activeRepo,
  locked = false,
  activeReportState
}: SessionRailProps) {
  const [query, setQuery] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const mapPopRef = useRef<HTMLDivElement | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const folderPopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (mapPopRef.current?.contains(event.target as Node)) return;
      setMapOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mapOpen]);
  useEffect(() => {
    if (!folderOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (folderPopRef.current?.contains(event.target as Node)) return;
      setFolderOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFolderOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [folderOpen]);
  const harnesses = useMemo(() => [...new Set(sessions.map((s) => s.harness))].sort(), [sessions]);
  const emptyCount = useMemo(() => sessions.filter((s) => s.eventCount === 0).length, [sessions]);
  // a persisted filter can name a harness or folder with no sessions this
  // scan; effectiveFilters drops those so the list is never empty with no
  // visible control to clear it
  const effective = useMemo(
    () => effectiveFilters(sessions, { hideEmpty, harness: harnessFilter, folder: folderFilter }),
    [sessions, hideEmpty, harnessFilter, folderFilter]
  );
  // everything every control except the folder allows: the population the
  // dropdown counts against, so its numbers are what clicking a row shows
  const unfoldered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((session) => {
      if (!sessionVisible(session, { hideEmpty, harness: effective.harness }, activeKey)) return false;
      if (!q) return true;
      return `${session.title ?? ""} ${session.id} ${session.gitBranch ?? ""} ${session.harness}`
        .toLowerCase()
        .includes(q);
    });
  }, [sessions, query, hideEmpty, effective.harness, activeKey]);
  const shown = useMemo(
    () => (effective.folder ? unfoldered.filter((s) => sessionFolder(s) === effective.folder) : unfoldered),
    [unfoldered, effective.folder]
  );
  const folders = useMemo(() => folderOptions(unfoldered, effective.folder), [unfoldered, effective.folder]);
  const groups = useMemo(
    () => (groupByFolder ? groupSessions(shown, folders.map((folder) => folder.key)) : []),
    [groupByFolder, shown, folders]
  );

  // one row implementation for both the flat and the grouped list, so the
  // eval-badge precedence below lives in exactly one place
  const renderRow = (session: SessionMeta) => (
    <button
      key={session.key}
      className={session.key === activeKey ? "session-row active" : "session-row"}
      onClick={() => onSelect(session.key)}
      disabled={locked}
    >
      <span className="session-title">{session.title || session.id}</span>
      <span className="session-meta">
        <span className="session-meta-text">
          {harnessLabel(session.harness)} · {session.eventCount}{" "}
          {session.eventCount === 1 ? "call" : "calls"}
          {session.gitBranch ? ` · ${session.gitBranch}` : ""}
          {session.endedAt ? ` · ${shortDate(session.endedAt)}` : ""}
        </span>
        {(() => {
          // the panel's digest-based status outranks the list's cheap
          // event-count grading for the active session
          const evalState =
            session.key === activeKey && activeReportState !== undefined
              ? activeReportState
              : session.reportState;
          return evalState ? (
            <span
              className={`rail-eval rail-eval-${evalState}`}
              title={evalHint(evalState)}
              aria-label={evalHint(evalState)}
            >
              {evalState === "running" ? "evaluating" : ""}
            </span>
          ) : null;
        })()}
      </span>
    </button>
  );

  return (
    <aside className={collapsed ? "session-rail collapsed" : "session-rail"}>
      <div className="rail-head">
        <h1 className="wordmark">
          <LogoMark />
          <span>
            Space Walk<span className="spark">.</span>
          </span>
        </h1>
        <div className="rail-head-actions">
          <div className="rail-map" ref={mapPopRef}>
            <button
              className="icon-btn"
              onClick={() => setMapOpen((open) => !open)}
              aria-expanded={mapOpen}
              title="Open a repository map"
              aria-label="Open a repository map"
            >
              <FolderOpen size={15} />
            </button>
            {mapOpen ? (
              <div className="rail-map-pop">
                {activeRepo ? (
                  <button
                    className="rail-map-primary"
                    onClick={() => {
                      onOpenMap(activeRepo);
                      setMapOpen(false);
                    }}
                    title={`Open the map of ${activeRepo}`}
                  >
                    <FolderOpen size={14} aria-hidden />
                    <span className="rail-map-primary-text">
                      <span className="rail-map-primary-name">{repoBasename(activeRepo)}</span>
                      {/* the leading LRM pins the path's neutral "/" runs to
                          LTR order inside the RTL ellipsis-at-start trick */}
                      <span className="rail-map-primary-path">{"\u200E" + activeRepo}</span>
                    </span>
                  </button>
                ) : null}
                {activeRepo ? (
                  <div className="rail-map-divider" aria-hidden>
                    <span>or open any repository</span>
                  </div>
                ) : (
                  <p className="rail-map-label">Open a repository map</p>
                )}
                <form
                  className="rail-map-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const path = repoPath.trim();
                    if (path) {
                      onOpenMap(path);
                      setMapOpen(false);
                    }
                  }}
                >
                  <input
                    type="text"
                    className="rail-map-input"
                    placeholder="/path/to/repo"
                    value={repoPath}
                    onChange={(e) => setRepoPath(e.currentTarget.value)}
                    spellCheck={false}
                  />
                  <button type="submit" className="rail-map-go" disabled={repoPath.trim() === ""}>
                    Open
                  </button>
                </form>
              </div>
            ) : null}
          </div>
          {onOpenConstellation ? (
            <button
              className="icon-btn"
              onClick={onOpenConstellation}
              disabled={locked}
              title="Constellation — all sessions on one clock"
              aria-label="Constellation — all sessions on one clock"
            >
              <Rows3 size={15} />
            </button>
          ) : null}
          <button
            className="icon-btn"
            onClick={onRefresh}
            disabled={locked}
            title="Rescan sessions"
            aria-label="Rescan sessions"
          >
            <RefreshCw size={15} />
          </button>
          <button
            className="icon-btn"
            onClick={onCollapse}
            title={`Hide sidebar (${toggleRailShortcut})`}
            aria-label="Hide session sidebar"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
      </div>
      <div className="rail-controls">
        <div className="rail-search-row">
          <label className="rail-filter">
            <Search size={14} aria-hidden />
            <input
              type="search"
              placeholder="Filter sessions"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              aria-label="Filter sessions"
            />
          </label>
          <div className="rail-folder" ref={folderPopRef}>
            <button
              className={effective.folder ? "icon-btn rail-folder-btn filtering" : "icon-btn rail-folder-btn"}
              onClick={() => setFolderOpen((open) => !open)}
              aria-expanded={folderOpen}
              title={folderTitle(folders, effective.folder)}
              aria-label={folderTitle(folders, effective.folder)}
            >
              <ListFilter size={15} />
            </button>
            {folderOpen ? (
              <div className="rail-folder-pop">
                <p className="rail-map-label">Filter by folder</p>
                <div className="rail-folder-list" role="group" aria-label="Folders">
                  <button
                    className={effective.folder ? "rail-folder-row" : "rail-folder-row active"}
                    aria-pressed={effective.folder === undefined}
                    onClick={() => {
                      onFolderFilterChange(undefined);
                      setFolderOpen(false);
                    }}
                  >
                    <span className="rail-folder-name">All folders</span>
                    <span className="rail-folder-count">{unfoldered.length}</span>
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.key}
                      className={
                        effective.folder === folder.key ? "rail-folder-row active" : "rail-folder-row"
                      }
                      aria-pressed={effective.folder === folder.key}
                      onClick={() => {
                        onFolderFilterChange(folder.key);
                        setFolderOpen(false);
                      }}
                      title={folder.path ?? "Sessions with no recorded working directory"}
                    >
                      <span className="rail-folder-name">{folder.label}</span>
                      <span className="rail-folder-count">{folder.count}</span>
                    </button>
                  ))}
                </div>
                <div className="rail-map-divider" aria-hidden>
                  <span>view</span>
                </div>
                <button
                  className={groupByFolder ? "rail-folder-row active" : "rail-folder-row"}
                  aria-pressed={groupByFolder}
                  onClick={() => onGroupByFolderChange(!groupByFolder)}
                >
                  <Layers size={14} aria-hidden />
                  <span className="rail-folder-name">Group by folder</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {harnesses.length > 1 || emptyCount > 0 ? (
          <div className="rail-chips" role="group" aria-label="Session filters">
            {harnesses.length > 1 ? (
              <>
                <button
                  className={effective.harness === undefined ? "chip active" : "chip"}
                  onClick={() => onHarnessFilterChange(undefined)}
                >
                  all
                </button>
                {harnesses.map((harness) => (
                  <button
                    key={harness}
                    className={effective.harness === harness ? "chip active" : "chip"}
                    onClick={() => onHarnessFilterChange(harness)}
                  >
                    {harnessLabel(harness)}
                  </button>
                ))}
              </>
            ) : null}
            {emptyCount > 0 ? (
              <button
                className={hideEmpty ? "eye-toggle" : "eye-toggle showing"}
                onClick={() => onHideEmptyChange(!hideEmpty)}
                aria-pressed={!hideEmpty}
                title={
                  hideEmpty ? `Show ${emptyCount} empty sessions` : `Hide ${emptyCount} empty sessions`
                }
                aria-label={
                  hideEmpty ? `Show ${emptyCount} empty sessions` : `Hide ${emptyCount} empty sessions`
                }
              >
                {hideEmpty ? <EyeOff size={13} aria-hidden /> : <Eye size={13} aria-hidden />}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="session-list" aria-busy={loading}>
        {groupByFolder
          ? groups.map((group) => (
              <div className="session-group" key={group.key}>
                <div className="session-group-head" title={group.path ?? group.label}>
                  <span className="session-group-name">{group.label}</span>
                  <span className="session-group-count">{group.count}</span>
                </div>
                {group.sessions.map(renderRow)}
              </div>
            ))
          : shown.map(renderRow)}
        {shown.length === 0 ? (
          <p className="muted" style={{ padding: "10px 8px" }}>
            {loading && sessions.length === 0
              ? "Scanning sessions…"
              : effective.folder
                ? "No sessions in this folder."
                : "No matching sessions."}
          </p>
        ) : null}
      </div>
      <div className="rail-foot">
        {shown.length === sessions.length
          ? `${sessions.length} session${sessions.length === 1 ? "" : "s"}`
          : `${shown.length} of ${sessions.length} sessions`}
      </div>
    </aside>
  );
});

// the closed control has to say whether the list is narrowed, since the only
// other statement of it lives inside the popover
function folderTitle(folders: FolderOption[], selected?: string): string {
  if (!selected) return "Filter by folder";
  const match = folders.find((folder) => folder.key === selected);
  return `Filtered to ${match?.label ?? selected}`;
}

function repoBasename(path: string): string {
  const clean = path.replace(/\/+$/, "");
  return clean.slice(clean.lastIndexOf("/") + 1) || clean;
}

function evalHint(state: "running" | "done" | "stale" | "failed"): string {
  switch (state) {
    case "running":
      return "Evaluation in progress";
    case "done":
      return "Evaluation ready";
    case "stale":
      return "Evaluation ready, but the session has grown since";
    case "failed":
      return "Last evaluation failed";
  }
}

function harnessLabel(harness: string): string {
  switch (harness) {
    case "claude-code":
      return "claude";
    default:
      return harness;
  }
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const md = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return sameYear ? `${md} ${hm}` : `${d.getFullYear()}-${md}`;
}
