"use client";

import { useEffect } from "react";
import { useUiStore } from "@/lib/ui-store";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable ||
    el.closest("[contenteditable=true]") !== null
  );
}

/*
  Global keyboard shortcuts, Linear style:
    C          new issue
    Cmd/Ctrl K command palette
*/
export function GlobalHotkeys() {
  const openNewIssue = useUiStore((s) => s.openNewIssue);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!useUiStore.getState().commandOpen);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        openNewIssue();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openNewIssue, setCommandOpen]);

  return null;
}
