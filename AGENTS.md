<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# linear-clone, agent operating manual

A Linear-style tracker (issues, OKRs, sprints, calendar, members) built to
look and feel exactly like Linear's dark app. UI-first v0: domain data
lives in a seeded zustand store persisted to localStorage.

Read before writing code, in this order:

1. `docs/ARCHITECTURE.md`: layers, data flow, route map, how to add a feature
2. `docs/DESIGN.md`: tokens, type scale, and the UI recipes every surface follows
3. `docs/CONVENTIONS.md`: hard rules (naming, imports, styling, state)

## Invariants (do not break)

- All domain types in `lib/types.ts`; all domain mutations through
  `lib/store.ts` actions; ephemeral UI state in `lib/ui-store.ts`.
- Routes in `app/` stay thin; feature UI lives in `features/<name>/`.
- Visual decisions come from `docs/DESIGN.md` tokens and recipes. No raw
  hex colors outside `globals.css`, `lib/seed.ts`, `components/icons/`.
- Global dialogs/palette mount once in `app/(app)/layout.tsx`, driven via
  `ui-store`; pages never instantiate their own copies.
- Pages under `app/(app)/` render inside `StoreHydrated`; never add
  per-page hydration or `typeof window` guards.
- No new dependencies without updating README.md's stack list.
- Clerk is optional at runtime (`lib/auth.ts` gates it). Never render
  Clerk components outside an `authEnabled` check.
- Next 16: the request proxy lives in `proxy.ts` (not `middleware.ts`).
- No em dashes or en dashes in any output (code, comments, docs, UI copy).

## Commands

```bash
pnpm dev      # dev server
pnpm build    # production build
pnpm lint     # eslint
```
