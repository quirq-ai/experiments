# Changelog

All notable changes to the XO Visualizer. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are YYYY-MM-DD.

## [0.2.0] - 2026-06-08

### Added
- **Run panel (split-pane):** running the repo's current working tree now shows
  live in the left half of the stage alongside the wave, instead of a modal
  (`components/run-panel.tsx`).
- **Dev-server process manager:** `GET /api/preview` lists every running dev
  server (the ones this tool started plus any other on the machine, with project
  dir + pid). The run panel has a "Running dev servers" drawer with per-process
  Stop, stops everything it started on close, and can stop a conflicting
  external server by pid. The visualizer's own server is self-protected.
- **Experiment button:** `POST /api/experiment` creates a git worktree on a new
  `experiment/N` branch with an empty start-commit, then opens an interactive
  Claude Code session in it (new macOS Terminal). The branch appears at the top
  of the right "Analyze" sidebar immediately.
- **Working-state readout:** `GET /api/state` plus the `current-state.tsx` card
  (branch, HEAD, dirty counts, ahead/behind, uncommitted +/- lines).

### Fixed
- Guarded the run preview's auto-start against React StrictMode's double-invoke,
  which launched a second `next dev` and tripped "another next dev server is
  already running."

### Changed
- Run UI moved from a full-screen modal to the split-pane; removed the dead
  `state-run-modal.tsx`.

## [0.1.0]

### Added
- Initial visualizer: histography-style commit wave (canvas), branch sidebar,
  hover-to-inspect, commit-detail modal with per-commit live preview, and
  server-side git access (branches, commits, commit detail) via Route Handlers.
