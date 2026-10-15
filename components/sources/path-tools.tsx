"use client";

import { useState } from "react";
import { errorOf, post } from "./request";

// The two or three small tools at the end of a generated-data row: copy the path, open
// its folder, and for the tab's own history file, open it in a text editor. Quiet until
// the row is hovered or focused; always there on a touch screen.

const tool =
  "grid size-7 place-items-center rounded-full text-muted transition-colors hover:bg-bg-sunk hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

export function PathTools({ id, label, path, editable = false }: { id: string; label: string; path: string; editable?: boolean }) {
  const [state, setState] = useState<"copied" | "opened" | string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(path);
      setState("copied");
    } catch {
      setState("Select the path to copy it.");
    }
    setTimeout(() => setState(null), 1600);
  }

  async function open(action: "reveal" | "edit") {
    try {
      await post("/api/sources/open", { target: id, action });
      setState("opened");
    } catch (err) {
      setState(errorOf(err));
    }
    setTimeout(() => setState(null), 2400);
  }

  return (
    <span className="flex shrink-0 items-center gap-0.5 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
      {state && state !== "copied" && state !== "opened" && (
        <span role="alert" className="mr-1 max-w-[180px] truncate text-[11.5px] text-ink" title={state}>
          {state}
        </span>
      )}
      <button type="button" onClick={() => void copy()} aria-label={`Copy the path of ${label}`} title={state === "copied" ? "Copied" : "Copy path"} className={tool}>
        {state === "copied" ? (
          <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5L20 7" />
          </svg>
        ) : (
          <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V6a2 2 0 0 1 2-2h9" />
          </svg>
        )}
      </button>
      <button type="button" onClick={() => void open("reveal")} aria-label={`Open the folder of ${label}`} title="Open folder" className={tool}>
        <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
      </button>
      {editable && (
        <button type="button" onClick={() => void open("edit")} aria-label={`Edit ${label}`} title="Edit" className={tool}>
          <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h4L19 9l-4-4L4 16Z" />
          </svg>
        </button>
      )}
    </span>
  );
}
