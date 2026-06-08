"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, ExternalLink, Loader2, Play, Square, X } from "lucide-react";
import { useVisualizer } from "@/lib/visualizer-store";

type RunState = "starting" | "running" | "error";

interface TrackedPreview {
  id: string;
  repo: string;
  label: string;
  port: number;
  url: string;
  hash: string;
  current: boolean;
}

interface DetectedServer {
  pid: number;
  port: number;
  command: string;
  dir?: string;
  label?: string;
  tracked: boolean;
  self: boolean;
}

/**
 * Inline preview of the repo's current working tree, run in place (POST
 * /api/preview with current:true) as the left half of the split stage.
 *
 * Also a process manager: it lists every dev server currently running, the ones
 * this tool started (stoppable cleanly) and any others on the machine (so a
 * "another next dev server is already running" failure is explainable and
 * fixable). Auto-starts exactly once; stops the servers it started on close.
 */
export function RunPanel() {
  const path = useVisualizer((s) => s.path);
  const closeRun = useVisualizer((s) => s.closeRun);

  const [runState, setRunState] = useState<RunState>("starting");
  const [url, setUrl] = useState("");
  const [cmd, setCmd] = useState("");
  const [id, setId] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const [tracked, setTracked] = useState<TrackedPreview[]>([]);
  const [servers, setServers] = useState<DetectedServer[]>([]);
  const [procsOpen, setProcsOpen] = useState(false);

  const idRef = useRef<string | null>(null);
  idRef.current = id;
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  const loadProcs = useCallback(async () => {
    try {
      const res = await fetch("/api/preview");
      if (!res.ok) return;
      const data = (await res.json()) as {
        tracked?: TrackedPreview[];
        servers?: DetectedServer[];
      };
      setTracked(data.tracked ?? []);
      setServers(data.servers ?? []);
    } catch {
      /* listing is best-effort */
    }
  }, []);

  const start = useCallback(async () => {
    setRunState("starting");
    setErr("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo: path.trim(), current: true }),
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        id?: string;
        url?: string;
        command?: string;
        error?: string;
        log?: string;
      };
      if (!res.ok || data.error || !data.url) {
        const msg = data.error || "run failed";
        throw new Error(data.log ? `${msg}\n\n${data.log}` : msg);
      }
      setId(data.id ?? null);
      setUrl(data.url);
      setCmd(data.command ?? "");
      setRunState("running");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setErr((e as Error).message);
      setRunState("error");
    } finally {
      loadProcs();
    }
  }, [path, loadProcs]);

  // Auto-start exactly once. React StrictMode invokes effects twice in dev;
  // without this guard that POSTs twice and the second `next dev` trips
  // "another next dev server is already running".
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start();
  }, [start]);

  // On unmount (panel closed), cancel any in-flight start and stop every server
  // this tool started. keepalive lets the stop land even if the tab is closing.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      fetch("/api/preview", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
        keepalive: true,
      }).catch(() => {});
    };
  }, []);

  const close = useCallback(() => {
    abortRef.current?.abort();
    closeRun(); // unmount cleanup stops the tool's servers
  }, [closeRun]);

  const stopTracked = useCallback(
    async (tid: string) => {
      await fetch("/api/preview", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: tid }),
      }).catch(() => {});
      if (tid === idRef.current) {
        setId(null);
        setUrl("");
        setErr("Stopped.");
        setRunState("error");
      }
      loadProcs();
    },
    [loadProcs],
  );

  const killServer = useCallback(
    async (pid: number) => {
      await fetch("/api/preview", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pid }),
      }).catch(() => {});
      loadProcs();
    },
    [loadProcs],
  );

  const retry = useCallback(() => {
    void start();
  }, [start]);

  // External dev servers (not started here, not this app) — these are what
  // collide with an in-place run.
  const others = servers.filter((s) => !s.self && !s.tracked);
  const procCount = tracked.length + others.length;
  const conflict = /already running|EADDRINUSE|address already in use/i.test(err);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 text-[12px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <span
            className={`size-2 shrink-0 rounded-full ${
              runState === "running"
                ? "bg-primary"
                : runState === "starting"
                  ? "animate-pulse bg-[#f0c34a]"
                  : "bg-[#ff5d6c]"
            }`}
          />
          Current state{cmd ? ` · ${cmd}` : ""}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => {
              setProcsOpen((o) => !o);
              loadProcs();
            }}
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 transition-colors ${
              procsOpen
                ? "border-border text-foreground"
                : "border-transparent hover:text-foreground"
            }`}
            title="Show all running dev servers"
          >
            <Circle className="size-3" />
            {procCount} running
          </button>
          {runState === "running" && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
              Open
            </a>
          )}
          <button
            onClick={close}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 transition-colors hover:border-destructive hover:text-[#ff9aa3]"
          >
            {runState === "running" ? (
              <Square className="size-3" />
            ) : (
              <X className="size-3" />
            )}
            {runState === "running" ? "Stop" : "Close"}
          </button>
        </div>
      </div>

      {/* Processes drawer */}
      {procsOpen && (
        <ProcessList
          tracked={tracked}
          others={others}
          currentId={id}
          onStopTracked={stopTracked}
          onKill={killServer}
          onRefresh={loadProcs}
        />
      )}

      {/* Body */}
      {runState === "running" ? (
        <iframe
          src={url}
          title="Current state preview"
          className="min-h-0 w-full flex-1 bg-white"
        />
      ) : runState === "starting" ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-[13px] text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          Booting the repo&apos;s dev server…
          <span className="text-[11px] text-muted-foreground">
            running it in place on a free port
          </span>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-[#ff9aa3]">
            <div className="mb-1 font-medium">Could not run current state</div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#ffb3ba]">
              {err}
            </pre>
            {conflict && others.length > 0 && (
              <div className="mt-3 border-t border-destructive/30 pt-2">
                <div className="mb-1.5 text-[11px] font-medium text-[#ffb3ba]">
                  A dev server is already running for this repo. Stop it, then
                  retry:
                </div>
                <div className="space-y-1">
                  {others.map((s) => (
                    <div
                      key={s.pid}
                      className="flex items-center justify-between gap-2 rounded border border-border bg-background/40 px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      <span className="truncate font-mono">
                        {s.label ?? s.command} · :{s.port} · pid {s.pid}
                      </span>
                      <button
                        onClick={() => killServer(s.pid)}
                        className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 transition-colors hover:border-destructive hover:text-[#ff9aa3]"
                      >
                        <X className="size-3" />
                        Stop
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={retry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Play className="size-3.5" />
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProcessList({
  tracked,
  others,
  currentId,
  onStopTracked,
  onKill,
  onRefresh,
}: {
  tracked: TrackedPreview[];
  others: DetectedServer[];
  currentId: string | null;
  onStopTracked: (id: string) => void;
  onKill: (pid: number) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="max-h-52 shrink-0 overflow-auto border-b border-border bg-background/40 px-3 py-2 text-[11px]">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-medium uppercase tracking-wider text-muted-foreground">
          Running dev servers
        </span>
        <button
          onClick={onRefresh}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      {tracked.length === 0 && others.length === 0 && (
        <p className="py-1 text-muted-foreground">No dev servers detected.</p>
      )}

      {tracked.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-[10px] text-muted-foreground">
            Started here
          </div>
          <div className="space-y-1">
            {tracked.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2 py-1"
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate text-foreground">
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="truncate">{t.label}</span>
                  <span className="shrink-0 font-mono text-muted-foreground">
                    :{t.port}
                  </span>
                  {t.id === currentId && (
                    <span className="shrink-0 rounded bg-primary/10 px-1 text-[9px] text-[#9be35a]">
                      this run
                    </span>
                  )}
                </span>
                <button
                  onClick={() => onStopTracked(t.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-muted-foreground transition-colors hover:border-destructive hover:text-[#ff9aa3]"
                >
                  <Square className="size-2.5" />
                  Stop
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] text-muted-foreground">
            Also running (started outside the visualizer)
          </div>
          <div className="space-y-1">
            {others.map((s) => (
              <div
                key={s.pid}
                className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2 py-1"
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                  <span className="size-1.5 shrink-0 rounded-full bg-[#f0c34a]" />
                  <span className="truncate">{s.label ?? s.command}</span>
                  <span className="shrink-0 font-mono">:{s.port}</span>
                  <span className="shrink-0 font-mono text-[10px] opacity-70">
                    pid {s.pid}
                  </span>
                </span>
                <button
                  onClick={() => onKill(s.pid)}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 transition-colors hover:border-destructive hover:text-[#ff9aa3]"
                >
                  <X className="size-2.5" />
                  Stop
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
