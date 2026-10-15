# Conventions

Hard rules. PRs that break them get reworked.

## Files and naming

- Kebab-case filenames: `new-issue-modal.tsx`. Named exports only
  (Next.js route files are the exception and default-export).
- One component per file unless the extras are private helpers used only
  in that file.
- Feature code lives in `features/<feature>/components/` (and `hooks/` if
  needed). Route files in `app/` stay under ~30 lines: import a feature
  component, render it.
- Shared code graduates: used by 2+ features means it moves to
  `components/shared/` (UI) or `lib/helpers.ts` (logic), in its own PR.

## Imports

- Always `@/` alias, never relative paths that climb (`../../`).
- Import shadcn primitives from `@/components/ui/*` only. Do not fork a
  primitive; extend at the call site with `className`, or add a variant
  inside the primitive file itself if it is truly global.

## Components

- Client components declare `"use client"` on line 1. Keep server
  components server; do not add `"use client"` to a file that does not use
  hooks, browser APIs, or event handlers.
- Domain state: select from `useAppStore` with narrow selectors
  (`useAppStore((s) => s.issues)`), mutate only via store actions.
  React state is for purely local UI (an open popover, an input draft).
- Selectors must return stable references: select whole slices
  (`s.issues`, `s.labels`) or primitives, then derive with
  `filter`/`find` in the component body. Returning a fresh array or
  object from a selector makes zustand v5 re-render in a loop.
- Dialogs and palettes that any page can open live in `app/(app)/layout.tsx`
  and are driven by `lib/ui-store.ts`.
- Dates are ISO strings (`yyyy-MM-dd`) in the store; format with helpers
  from `lib/helpers.ts` at render time only.

## Styling

- Tailwind classes only; no CSS modules, no styled-jsx, no inline `style`
  except for data-driven colors (label dots, avatar backgrounds).
- Use token classes from docs/DESIGN.md (`bg-panel`, `text-faint`, ...).
  A raw hex value outside `globals.css`, `lib/seed.ts`, or
  `components/icons/` is a review flag.
- Follow the recipes in docs/DESIGN.md for rows, chips, pickers, dialogs,
  and empty states before designing anything new.
- `cn()` from `@/lib/utils` for conditional classes.

## Dependencies

Adding a dependency requires updating README.md's stack list in the same
change and a one-line justification in the PR. Prefer shadcn/radix,
lucide, date-fns, zustand: they already cover most needs.

## Copy and punctuation

- UI copy is sentence case ("New issue", not "New Issue").
- No em dashes or en dashes anywhere: code, comments, docs, UI strings.
  Use a comma, colon, or period instead.

## TypeScript

- No `any`, no non-null assertions unless provably safe with a comment.
- Domain types come from `lib/types.ts`; never redeclare them locally.
- Derive display strings via `statusLabel`, `priorityLabel`, `healthLabel`.
