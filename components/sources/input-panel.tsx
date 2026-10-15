"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { button, errorOf, fine, post } from "./request";

// Sources, part I: what Innernet reads. Two rows set like the rest of the page, each with
// a switch: the folders on this machine, and the GitHub repositories it collects. Every
// change saves at once (/api/sources); Sync now rebuilds what is switched on. Times and
// counts arrive from the server already worded, so nothing here disagrees with it.

type Selection = { local: boolean; remote: boolean };

export interface InputPanelProps {
  selection: Selection;
  repositories: string[];
  legacyAccount: string | null;
  local: { roots: string[]; depth: string | null; facts: string | null; error: string | null };
  remote: { facts: string | null; error: string | null };
}

function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative mt-[3px] h-[18px] w-8 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? "border-ink bg-ink" : "border-line-strong bg-bg-sunk"}`}
    >
      <span aria-hidden className={`absolute top-1/2 size-3 -translate-y-1/2 rounded-full transition-[left,background-color] ${on ? "left-[15px] bg-bg" : "left-[2px] bg-muted"}`} />
    </button>
  );
}

/** Repository entries from what was typed or pasted: one per line, comma or space. */
const entries = (text: string) => text.split(/[\s,]+/).map((e) => e.trim()).filter(Boolean);

export function InputPanel({ selection, repositories, legacyAccount, local, remote }: InputPanelProps) {
  const router = useRouter();
  const addId = useId();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [draft, setDraft] = useState("");

  async function save(next: Selection, repos: string[], done: string, name: string) {
    setBusy(name);
    setMessage(null);
    try {
      await post("/api/sources", { action: "save", selection: next, remote: { repositories: repos } });
      setMessage({ error: false, text: done });
      router.refresh();
      return true;
    } catch (err) {
      setMessage({ error: true, text: errorOf(err) });
      return false;
    } finally {
      setBusy(null);
    }
  }

  function toggle(which: keyof Selection) {
    const next = { ...selection, [which]: !selection[which] };
    if (!next.local && !next.remote) return setMessage({ error: true, text: "Keep at least one source on." });
    if (which === "remote" && next.remote && !repositories.length) return setMessage({ error: true, text: "Add a repository first." });
    void save(next, repositories, next[which] ? "Switched on. Sync to bring its pages in." : "Switched off. Its pages are out of search and Innerpedia.", which);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const typed = entries(draft);
    if (!typed.length) return;
    // A first repository switches Remote on: that is what adding one means.
    const next = repositories.length ? selection : { ...selection, remote: true };
    if (await save(next, [...repositories, ...typed], typed.length === 1 ? "Added. Sync to bring it in." : `Added ${typed.length}. Sync to bring them in.`, "add")) setDraft("");
  }

  function remove(repo: string) {
    const repos = repositories.filter((r) => r !== repo);
    if (!repos.length && !selection.local) return setMessage({ error: true, text: "Keep at least one source on: switch Local on first." });
    void save(repos.length ? selection : { ...selection, remote: false }, repos, `Removed ${repo}.`, `remove:${repo}`);
  }

  async function sync() {
    setBusy("sync");
    setMessage({ error: false, text: "Syncing. This can take a minute." });
    try {
      const r = await post<{ pages: number; durationMs: number }>("/api/sources/sync", {});
      setMessage({ error: false, text: `Synced: ${r.pages.toLocaleString("en-US")} pages in ${Math.max(1, Math.round(r.durationMs / 1000))} s.` });
      router.refresh();
    } catch (err) {
      setMessage({ error: true, text: errorOf(err) });
    } finally {
      setBusy(null);
    }
  }

  const openConfig = async () => {
    try {
      await post("/api/sources/open", { target: "config", action: "edit" });
      setMessage({ error: false, text: "Opened innernet.config.json. Save it, then sync." });
    } catch (err) {
      setMessage({ error: true, text: errorOf(err) });
    }
  };

  return (
    <div className="mt-2">
      <div className="flex gap-4 border-b border-line py-6">
        <Switch on={selection.local} label="Folders on this machine" disabled={!!busy} onChange={() => toggle("local")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-[15px] font-medium text-ink">Folders on this machine</h3>
            <button type="button" onClick={() => void openConfig()} className="link text-[13px]">
              Edit folders
            </button>
          </div>
          {local.error ? (
            <p className="mt-1.5 text-[13.5px] text-ink">{local.error}</p>
          ) : (
            <p className="mt-1.5 font-mono text-[13px] text-ink-2">
              {local.roots.join(", ")}
              {local.depth != null && <span className="text-muted">, {local.depth} levels deep</span>}
            </p>
          )}
          {local.facts && <p className={`mt-1 ${fine}`}>{local.facts}</p>}
        </div>
      </div>

      <div className="flex gap-4 border-b border-line py-6">
        <Switch on={selection.remote} label="GitHub repositories" disabled={!!busy || (!repositories.length && !selection.remote)} onChange={() => toggle("remote")} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-medium text-ink">GitHub repositories</h3>
          <p className={`mt-1 ${fine}`}>Public repositories from any account, read anonymously.</p>
          {legacyAccount && !repositories.length && (
            <p className="mt-2 text-[13px] text-ink">Remote used to take all of {legacyAccount}&apos;s repositories. Add the ones you want.</p>
          )}
          {repositories.length > 0 && (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {repositories.map((repo) => (
                <li key={repo} className="group flex items-center justify-between gap-3 py-2">
                  <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-mono text-[13px] text-ink hover:text-link">
                    <span className="text-muted">{repo.split("/")[0]}/</span>
                    {repo.split("/")[1]}
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(repo)}
                    disabled={!!busy}
                    aria-label={`Remove ${repo}`}
                    title="Remove"
                    className="grid size-6 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-bg-sunk hover:text-ink disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={(e) => void add(e)} className="mt-3 flex items-center gap-2">
            <label htmlFor={addId} className="sr-only">
              Add a GitHub repository
            </label>
            <input
              id={addId}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="owner/name or a GitHub link"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={!!busy}
              className="h-8 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-3.5 font-mono text-[12.5px] text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link disabled:opacity-50"
            />
            <button type="submit" disabled={!!busy || !draft.trim()} className={button}>
              {busy === "add" ? "Adding" : "Add"}
            </button>
          </form>
          {(remote.error || remote.facts) && <p className={`mt-2 ${remote.error ? "text-[13px] text-ink" : fine}`}>{remote.error ?? remote.facts}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-5">
        <button type="button" onClick={() => void sync()} disabled={!!busy} className={`${button} border-ink text-ink`}>
          <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={busy === "sync" ? "motion-safe:animate-spin" : ""}>
            <path d="M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" />
          </svg>
          {busy === "sync" ? "Syncing" : "Sync now"}
        </button>
        <p role={message?.error ? "alert" : "status"} className={message?.error ? "text-[13px] text-ink" : fine}>
          {message?.text ?? "Rebuilds what is switched on. Saving and syncing show in History."}
        </p>
      </div>
    </div>
  );
}
