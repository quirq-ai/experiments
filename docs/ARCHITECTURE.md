# Architecture

A Linear-style tracker: Next.js 16 App Router, React 19, Tailwind v4,
shadcn/ui (radix), zustand, Clerk. Issues, members, labels and projects
mirror the .xo state files on disk (read only) via /api/xo routes;
sprints, OKRs and wiki docs are local slices persisted to localStorage.
The store's action surface is the future write back API contract.

## Layers

```
app/          Routes only. Thin: compose feature components, no logic.
features/     One folder per domain feature. Owns its components + hooks.
components/   Cross-feature UI: ui/ (shadcn), shell/ (chrome), shared/
              (atoms like MemberAvatar), icons/ (domain glyphs),
              providers/ (context and hydration gates).
lib/          Domain: types.ts, seed.ts, store.ts, ui-store.ts,
              helpers.ts, auth.ts, utils.ts (shadcn cn only).
docs/         This documentation.
```

Dependency direction: `app -> features -> components -> lib`. Features may
import from other features only via their public components (rare; prefer
lifting shared pieces into `components/shared`). `lib` imports nothing from
the layers above.

## Data flow

- `lib/types.ts` is the single domain model. `lib/seed.ts` keeps only
  fallbacks and color palettes (it is one of the three allowed raw hex
  files).
- `lib/store.ts` (zustand + persist) holds all domain state in two
  kinds of slices. Mirror slices (workspace, members, labels, projects,
  issues) load from `/api/xo/snapshot` via `loadSnapshot` on every page
  load; they are not persisted and local edits to them vanish on the
  next sync. Local slices (sprints, objectives, wikiDocs, xoConfig)
  persist to localStorage (`partialize`). Every mutation is a named
  action; feature components never call `set` directly and never keep
  domain state in React state.
- `lib/ui-store.ts` holds ephemeral UI state (global dialogs, palette).
  Not persisted.
- `components/providers/store-hydrated.tsx` rehydrates localStorage,
  then awaits the first snapshot fetch, then renders. Pages under
  `app/(app)/` are already inside this gate; never add per-page
  hydration or fetch logic.

## XO data layer

- `lib/xo-reader.ts` (server only, imported by the /api/xo routes)
  reads `.xo/todos.json` and `.xo/work-items.json` from the XO root and
  from each selected project folder, and maps them to domain records:
  todos and work items become issues (tagged with the "Agent todo" or
  "Work item" label), owners and creators become members, selected
  folders become projects. It never writes to a .xo file.
- Root resolution order: `?root=` query (set by the Setup dialog, saved
  in `xoConfig`), the `XO_ROOT` env var, then the topmost ancestor of
  the app directory containing `.xo`.
- `features/setup/components/setup-dialog.tsx` is the UI for choosing
  the root and the project folders. It persists `xoConfig` through the
  store and triggers a resync on save.
- The wiki docs "XO data flow" and "Anatomy of .xo and xo.json" (from
  `lib/system-docs.ts`, refreshed by version bump on snapshot load)
  document this pipeline with mermaid diagrams, inside the app itself.
- Selected folders appear as projects in the sidebar, each expanding to
  Work items and Sprints entries that link to the matching route.

### Swapping in write back later

Keep the store's action names and signatures; replace their bodies with
API calls against new /api/xo write routes. Because features only talk
to actions and selectors, no feature UI should change.

## Routes

| Route | Feature |
|---|---|
| `/` | redirect to `/my-issues` |
| `/inbox` | issues (notifications placeholder) |
| `/my-issues` | issues filtered to the current member |
| `/issues` | all issues, grouped and filterable |
| `/issue/[key]` | issue detail, key like `XO-12` |
| `/okrs`, `/okrs/[id]` | objectives and key results |
| `/sprints`, `/sprints/[id]` | sprint list and sprint detail |
| `/calendar` | month grid of sprints, OKR targets, due dates |
| `/wiki`, `/wiki/[id]` | internal wiki docs (view, edit, create, delete) |
| `/project/[id]/work-items`, `/project/[id]/sprints` | one project, split as in the sidebar; `/project/[id]` redirects |
| `/members` | member list + invite |
| `/sign-in`, `/sign-up` | Clerk (setup card when keys missing) |
| `/api/xo/folders` | GET: top level folders under the XO root (Setup dialog) |
| `/api/xo/snapshot` | GET: .xo todos and work items mapped to the domain |

All `(app)` pages are client components (`"use client"`): v0 reads from a
client store. Auth pages and the shell wrapper stay server components.

## Auth

Clerk is enabled when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set
(`lib/auth.ts`). When enabled: `ClerkProvider` wraps the root layout,
`proxy.ts` protects everything except the auth routes, and the sidebar
shows `UserButton`. When missing: open demo mode with the seeded user.
Mapping Clerk users to `Member` records is deliberately out of scope for
v0; `currentMemberId` in the store stands in for the session user.

## Shell and global surfaces

`app/(app)/layout.tsx` mounts, exactly once: `AppShell` (sidebar + panel),
`StoreHydrated`, `NewIssueModal`, `CommandPalette`, `GlobalHotkeys`.
Anything that must be reachable from every page (dialogs, hotkeys) mounts
here and is driven through `ui-store`, never instantiated inside pages.

## Adding a feature (the drill)

1. Extend `lib/types.ts`, `lib/seed.ts`, and add store actions in
   `lib/store.ts`. Types and actions first, UI second.
2. Create `features/<name>/components/`. Follow docs/DESIGN.md recipes.
3. Add thin route files under `app/(app)/<name>/`.
4. Add the nav item to `components/shell/sidebar.tsx` and, if useful,
   commands to the command palette.
5. Update the route table above and document any new visual pattern in
   docs/DESIGN.md.

## Deliberate v0 boundaries

No database and no write back to .xo files (the mirror is read only),
no drag and drop, no board view, no comments, no real notifications,
light theme deferred. The seams for each are noted above so they can
land without restructuring.
