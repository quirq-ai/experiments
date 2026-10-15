# linear-clone

A Linear-style project tracker: issues, OKRs, sprints, calendar, members,
and an internal wiki, with Linear's dark, dense, keyboard-driven UI.

Issues, members and projects are a read only mirror of the .xo state
files XO agents write on disk (todos.json, work-items.json). Sprints,
OKRs and the wiki stay local to the browser for now. The store's actions
are the contract a real write back API will implement later (see
docs/ARCHITECTURE.md and the "XO data flow" doc in the app wiki).

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4 + shadcn/ui (radix) + lucide-react
- zustand (state), date-fns (dates), mermaid (wiki diagrams)
- Clerk (auth, optional in dev)

## Run it

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. Without Clerk keys the app runs in open
mode as the workspace operator.

### Point it at your XO root

The XO root is the folder whose .xo directory (and project subfolders)
feed the app. Resolution order: the root set in the in-app **Setup**
dialog, then the `XO_ROOT` env var, then the topmost ancestor of this
app containing a `.xo` directory. Open Setup from the sidebar to change
the root and select which folders under it count as projects.

### Enable Clerk auth

1. Create an application at https://dashboard.clerk.com
2. `cp .env.example .env.local` and fill in
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
3. Restart `pnpm dev`. All app routes now require sign in.

## Keyboard

- `C` new issue
- `Cmd/Ctrl K` command palette

## Docs

- docs/ARCHITECTURE.md: layers, data flow, route map, how to add a feature
- docs/DESIGN.md: design tokens, type scale, UI recipes
- docs/CONVENTIONS.md: hard rules for files, imports, styling, state

Refresh from XO (workspace menu or command palette) resyncs the mirror
without a reload.
