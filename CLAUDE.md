# CLAUDE.md — XO Visualizer

Guidance for Claude Code working in this repo. Keep it current: when you add a
route, component, or convention, update this file and the CHANGELOG in the same
change.

## What this is

A calm, histography-style view of a git repo's history. The left "Visualize"
sidebar holds repository actions and the selected commit; the stage draws a
branch as a flowing wave (green additions above the centerline, red deletions
below); the right "Analyze" sidebar lists branches. Point it at any local repo
by absolute path. It can also run a repo's working tree live and spin off
isolated "experiment" worktrees with a Claude session in each.

Stack: Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4 +
shadcn/Radix. Client state in a single zustand store. Rendering is plain Canvas
2D, no charting deps.

## House rules

- **No em dashes or en dashes** anywhere (code, comments, markdown). Use colons,
  commas, periods, or parentheses. (Workspace-wide rule.)
- **All system/git access stays server-side.** Browser never touches the
  filesystem or shells out. Route Handlers run `git`/tools via `execFile` (no
  shell, so paths can't inject). The store fetches those routes. Keep it that way.
- **Match the existing style.** Dark XO theme tokens in `app/globals.css`
  (charcoal `#08090a`, lime `#83d63a`). Inline color literals like `#5ef38b`
  (add) / `#ff5d6c` (del) are used in components; reuse them.

## Commands

```bash
pnpm dev        # http://localhost:3000 (or PORT=7788 pnpm dev)
pnpm build
pnpm lint
npx tsc --noEmit   # typecheck (run before committing)
```

Boots on synthetic sample data when no repo is loaded, so the stage is never
empty.

## Map

```
app/
  page.tsx                 stage: commit wave, plus the RunPanel split-pane when a run is active
  layout.tsx               wraps children in ConditionalLayout (the app shell)
  globals.css              XO charcoal/lime theme tokens
  api/
    branches/route.ts      GET: list a repo's branches (for-each-ref)
    commits/route.ts       GET: one branch's commits with add/del numstat
    commit/route.ts        GET: full metadata for one commit
    state/route.ts         GET: repo working state (HEAD + staged/unstaged/untracked, ahead/behind, uncommitted +/-)
    preview/route.ts        POST run a commit (worktree) or current tree in place; GET list running dev servers; DELETE stop one/all/by-pid
    experiment/route.ts    POST: new worktree + experiment/N branch + start-commit, opens a Claude session in it
    pick-folder/route.ts   GET: native folder picker
components/
  conditional-layout.tsx   app shell: header (Create new, Experiment, Replay, Analyze), left+right sidebars, modals
  app-sidebar.tsx          left "Visualize": repo actions + CurrentState + selected commit
  analyze-sidebar.tsx      right "Analyze": the branch list (where experiment branches appear)
  current-state.tsx        working-state card (branch, HEAD, dirty, ahead/behind, "Run current state")
  run-panel.tsx            split-pane live preview of the current tree + running-dev-server manager
  CommitWave.tsx           the canvas wave (RAF)
  CommitDetailModal.tsx    expanded commit view + per-commit live preview
lib/
  gitLog.ts                git parsers: isGitRepo, listBranches, readGitLog, readCommitDetail, readRepoState
  visualizer-store.ts      zustand store: repo/branches/commits/state + actions (loadRepo, createExperiment, openRun, ...)
  sampleData.ts            synthetic branches/commits/state fallback
  types.ts                 Commit / Branch / CommitDetail / RepoState
```

## Gotchas

- **React StrictMode is on** (`next.config.ts`). Any effect that auto-starts a
  server/preview must be guarded to fire once (see `run-panel.tsx`
  `startedRef`), or it double-launches and trips "another next dev server is
  already running."
- **Live previews use git worktrees.** A commit preview checks out into a
  throwaway worktree under the system tmpdir; "current state" runs the repo in
  place. Experiment worktrees live in `<repo>/../.worktrees/<repo>/`.
- **`preview/route.ts` tracks running previews in a module global** and exposes
  them via `GET`. The visualizer's own server is flagged `self` and is never
  killable.
- **Experiment branches** are `experiment/N` (auto-numbered) with an empty
  start-commit so they show in the branch list immediately; the button also
  opens the right sidebar so the new branch is visible.
