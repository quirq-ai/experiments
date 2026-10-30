"use client";

import { useState } from "react";
import { FolderSync, Sparkles, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/** Feed any research (files of any format or pasted notes) to make a post. */
export function ResearchDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<"" | "create" | "sync">("");
  const [error, setError] = useState("");

  async function call(body: BodyInit, json = false) {
    const response = await fetch("/api/research", {
      method: "POST",
      body,
      headers: json ? { "content-type": "application/json" } : undefined,
    });
    const result =
      (await response.json().catch(() => ({}))) as { error?: string; posts?: number; failed?: number; errors?: string[] };
    if (!response.ok) throw new Error(result.error || "Generation failed.");
    return result;
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy || (!files.length && !text.trim())) return;
    setBusy("create");
    setError("");
    try {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      form.set("text", text);
      form.set("title", title);
      await call(form);
      setFiles([]);
      setText("");
      setTitle("");
      onDone("New post generated from your research");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy("");
    }
  }

  async function sync() {
    setBusy("sync");
    setError("");
    try {
      const result = await call(JSON.stringify({ action: "sync" }), true);
      if (result.failed)
        setError(`${result.failed} folders failed: ${result.errors?.[0] ?? ""}`);
      onDone(`${result.posts} research posts are up to date`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="timeline-import-dialog">
        <DialogTitle>Make a post from research</DialogTitle>
        <DialogDescription>
          Drop in anything: PDFs, notes, Markdown, CSV, JSON, HTML or code.
          Claude reads it and writes a carousel post.
        </DialogDescription>
        <form onSubmit={create}>
          <label>
            Title (optional)
            <input
              aria-label="Post title"
              value={title}
              disabled={!!busy}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What is this research about?"
            />
          </label>
          <label className="timeline-file-label">
            <Upload size={16} />
            {files.length
              ? `${files.length} file${files.length > 1 ? "s" : ""}: ${files.map((f) => f.name).join(", ").slice(0, 80)}`
              : "Choose files (any format)"}
            <input
              aria-label="Choose research files"
              type="file"
              multiple
              disabled={!!busy}
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
          </label>
          <label>
            Or paste notes
            <textarea
              aria-label="Research notes"
              rows={6}
              value={text}
              disabled={!!busy}
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste findings, a transcript, a link dump, a table..."
            />
          </label>
          {error && (
            <p className="timeline-import-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button"
            type="submit"
            disabled={!!busy || (!files.length && !text.trim())}
          >
            <Sparkles size={16} />{" "}
            {busy === "create" ? "Writing your post..." : "Generate post"}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!!busy}
            onClick={sync}
          >
            <FolderSync size={16} />{" "}
            {busy === "sync"
              ? "Scanning research folders..."
              : "Rescan local research folders"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
