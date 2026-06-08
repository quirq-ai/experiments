"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Copy,
  ExternalLink,
  FileDiff,
  GitCommit,
  Loader2,
  Play,
  Square,
  X,
} from "lucide-react";
import { CommitDetail } from "@/lib/types";

interface CommitDetailModalProps {
  detail: CommitDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  repoPath?: string;
  canPreview?: boolean;
}

type PreviewState = "idle" | "starting" | "running" | "error";

const SIG_LABEL: Record<string, string> = {
  G: "Good signature",
  B: "Bad signature",
  U: "Good, unknown validity",
  X: "Good, expired",
  Y: "Good, expired key",
  R: "Good, revoked key",
  E: "Cannot check",
  N: "Unsigned",
};

export function CommitDetailModal({
  detail,
  loading,
  error,
  onClose,
  repoPath,
  canPreview = false,
}: CommitDetailModalProps) {
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewCmd, setPreviewCmd] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewErr, setPreviewErr] = useState("");
  const [installing, setInstalling] = useState(false);

  const previewIdRef = useRef<string | null>(null);
  previewIdRef.current = previewId;
  const abortRef = useRef<AbortController | null>(null);

  const stopPreview = useCallback(() => {
    const id = previewIdRef.current;
    if (id) {
      fetch("/api/preview", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
        keepalive: true,
      }).catch(() => {});
    }
    setPreviewId(null);
    setPreviewUrl("");
    setPreviewCmd("");
    setPreviewState("idle");
  }, []);

  const cancelStart = useCallback(() => {
    abortRef.current?.abort();
    setPreviewState("idle");
  }, []);

  const startPreview = useCallback(
    async (opts?: { install?: boolean }) => {
    if (!detail || !repoPath) return;
    setInstalling(!!opts?.install);
    setPreviewState("starting");
    setPreviewErr("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repo: repoPath,
          hash: detail.hash,
          install: !!opts?.install,
        }),
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
        const msg = data.error || "preview failed";
        throw new Error(data.log ? `${msg}\n\n${data.log}` : msg);
      }
      setPreviewId(data.id ?? null);
      setPreviewUrl(data.url);
      setPreviewCmd(data.command ?? "");
      setPreviewState("running");
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // user canceled
      setPreviewErr((e as Error).message);
      setPreviewState("error");
    }
    },
    [detail, repoPath],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Tear down a running preview when the viewed commit changes or on unmount.
  const hash = detail?.hash;
  useEffect(() => {
    stopPreview();
  }, [hash, stopPreview]);
  useEffect(() => {
    return () => {
      const id = previewIdRef.current;
      if (id) {
        fetch("/api/preview", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, []);

  const showPlay =
    !!detail &&
    canPreview &&
    detail.source === "git" &&
    previewState !== "running" &&
    previewState !== "starting";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <GitCommit className="size-4 shrink-0 text-primary" />
            <span className="truncate text-[14px] font-medium text-foreground">
              {detail ? detail.subject : "Commit details"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {showPlay && (
              <button
                onClick={() => startPreview()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                title="Run the app as it was at this commit"
              >
                <Play className="size-3.5" />
                Play
              </button>
            )}
            <button
              onClick={onClose}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {previewState === "running" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2 text-[12px] text-muted-foreground">
              <span className="truncate">
                Live preview at{" "}
                <span className="font-mono text-[#9be35a]">
                  {detail?.shortHash}
                </span>
                {previewCmd ? ` · ${previewCmd}` : ""}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                  Open
                </a>
                <button
                  onClick={stopPreview}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 transition-colors hover:border-destructive hover:text-[#ff9aa3]"
                >
                  <Square className="size-3" />
                  Stop
                </button>
              </div>
            </div>
            <iframe
              src={previewUrl}
              title="Commit preview"
              className="min-h-0 w-full flex-1 bg-white"
            />
          </div>
        ) : previewState === "starting" ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-16 text-[13px] text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            {installing
              ? "Installing dependencies for this commit…"
              : "Starting the app at this commit…"}
            <span className="text-[11px] text-muted-foreground">
              {installing
                ? "running the package manager in the worktree (this can take a minute)"
                : "creating a worktree and booting the dev server (first compile can take a moment)"}
            </span>
            <button
              onClick={cancelStart}
              className="mt-1 rounded border border-border px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {previewErr && (
              <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-[#ff9aa3]">
                <div className="mb-1 font-medium">Could not start preview</div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#ffb3ba]">
                  {previewErr}
                </pre>
                {/(module not found|can'?t resolve|cannot find module)/i.test(
                  previewErr,
                ) && (
                  <button
                    onClick={() => startPreview({ install: true })}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Play className="size-3.5" />
                    Install dependencies & retry
                  </button>
                )}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading commit from git…
              </div>
            )}

            {error && !loading && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-[#ff9aa3]">
                {error}
              </div>
            )}

            {detail && !loading && (
              <div className="space-y-4">
                {detail.source === "sample" && (
                  <p className="rounded-md bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                    Sample data: full git metadata and live preview are available
                    once you load a real repository.
                  </p>
                )}

                <Field label="Commit">
                  <Mono copyable>{detail.hash}</Mono>
                </Field>
                <Field label="Tree">
                  <Mono>{detail.tree}</Mono>
                </Field>
                <Field label="Parents">
                  {detail.parents.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {detail.parents.map((p) => (
                        <Mono key={p}>{p.slice(0, 12)}</Mono>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[12px] text-muted-foreground">
                      (root commit)
                    </span>
                  )}
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Person label="Author" who={detail.author} />
                  <Person label="Committer" who={detail.committer} />
                </div>

                {detail.refs.length > 0 && (
                  <Field label="Refs">
                    <div className="flex flex-wrap gap-1.5">
                      {detail.refs.map((r) => (
                        <span
                          key={r}
                          className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-[#9be35a]"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </Field>
                )}

                <Field label="Signature">
                  <span className="text-[12px] text-foreground">
                    {SIG_LABEL[detail.signature.status] ??
                      detail.signature.status}
                    {detail.signature.signer
                      ? ` · ${detail.signature.signer}`
                      : ""}
                  </span>
                </Field>

                {detail.body && (
                  <Field label="Message">
                    <pre className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 font-mono text-[12px] leading-relaxed text-[#d7dad7]">
                      {detail.body}
                    </pre>
                  </Field>
                )}

                {detail.notes && (
                  <Field label="Notes">
                    <pre className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 font-mono text-[12px] text-[#d7dad7]">
                      {detail.notes}
                    </pre>
                  </Field>
                )}

                <div>
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <FileDiff className="size-3.5" />
                    {detail.filesChanged.toLocaleString()} file
                    {detail.filesChanged === 1 ? "" : "s"} changed
                    <span className="text-[#5ef38b]">
                      +{detail.totalAdd.toLocaleString()}
                    </span>
                    <span className="text-[#ff5d6c]">
                      -{detail.totalDel.toLocaleString()}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-md border border-border">
                    {detail.files.map((f, i) => (
                      <div
                        key={`${f.path}-${i}`}
                        className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5 last:border-b-0"
                      >
                        <span className="truncate font-mono text-[12px] text-[#c7ccc8]">
                          {f.oldPath ? `${f.oldPath} → ${f.path}` : f.path}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums">
                          {f.binary ? (
                            <span className="text-muted-foreground">binary</span>
                          ) : (
                            <>
                              <span className="text-[#5ef38b]">+{f.add}</span>{" "}
                              <span className="text-[#ff5d6c]">-{f.del}</span>
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                    {detail.files.length === 0 && (
                      <div className="px-3 py-2 text-[12px] text-muted-foreground">
                        No file changes
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function Person({
  label,
  who,
}: {
  label: string;
  who: { name: string; email: string; date: string };
}) {
  return (
    <Field label={label}>
      <div className="text-[13px] text-foreground">{who.name}</div>
      <div className="text-[11px] text-muted-foreground">{who.email}</div>
      <div className="text-[11px] text-muted-foreground">
        {who.date ? new Date(who.date).toLocaleString() : ""}
      </div>
    </Field>
  );
}

function Mono({
  children,
  copyable = false,
}: {
  children: string;
  copyable?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-[#c7ccc8]">
        {children}
      </span>
      {copyable && (
        <button
          onClick={() => navigator.clipboard?.writeText(children)}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Copy"
        >
          <Copy className="size-3" />
        </button>
      )}
    </span>
  );
}
