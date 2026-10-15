"use client";

import { create } from "zustand";
import type { Issue } from "./types";

/*
  Ephemeral UI state (not persisted): global dialogs and palettes.
  Feature components open these instead of owning dialog state so the
  sidebar, hotkeys, and command palette can all trigger them.
*/

interface UiState {
  newIssueOpen: boolean;
  /** Prefill for the new issue modal, e.g. { sprintId } from a sprint page */
  newIssueDefaults: Partial<Issue>;
  openNewIssue: (defaults?: Partial<Issue>) => void;
  setNewIssueOpen: (open: boolean) => void;

  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  setupOpen: boolean;
  setSetupOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  newIssueOpen: false,
  newIssueDefaults: {},
  openNewIssue: (defaults = {}) => set({ newIssueOpen: true, newIssueDefaults: defaults }),
  setNewIssueOpen: (open) => set({ newIssueOpen: open, ...(open ? {} : { newIssueDefaults: {} }) }),

  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),

  setupOpen: false,
  setSetupOpen: (open) => set({ setupOpen: open }),
}));
