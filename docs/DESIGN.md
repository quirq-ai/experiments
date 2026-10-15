# Design language

The target is Linear's dark app, replicated closely. Every visual decision
either comes from this file or gets added to this file. If you invent a new
pattern, document it here in the same PR.

## Principles

1. Dense, quiet, precise. 13px UI text, tight leading, generous truncation.
2. Color is information. Grey by default; color only for status, priority,
   health, labels, avatars, and the primary action.
3. Everything aligns to rows. Lists are the core surface; rows are 40px.
4. Hover states are washes (white at 4 to 8 percent), never new colors.
5. One primary button per view at most.

## Tokens (globals.css)

| Token | Value | Use |
|---|---|---|
| `background` | `#0f1011` | Window and sidebar |
| `panel` | `#101113` | Main content sheet |
| `card` | `#16171a` | Raised cards inside the panel |
| `popover` | `#1c1d21` | Menus, dialogs, pickers |
| `border` | `#23252a` | Hairlines |
| `input` | `#2c2d32` | Control borders, chip outlines |
| `foreground` | `#f7f8f8` | Primary text |
| `muted-foreground` | `#8a8f98` | Secondary text |
| `faint` | `#62666d` | Ids, timestamps, section labels |
| `accent` | `white 5%` | Hover wash |
| `selected` | `white 8%` | Active nav item, selected row |
| `primary` | `#5e6ad2` | Primary buttons, Done status, links |
| `destructive` | `#eb5757` | Destructive actions |

Status: `status-backlog #62666d`, `status-todo #8a8f98`,
`status-progress #f2c94c`, `status-review #4cb782`, `status-done #5e6ad2`,
`status-canceled #8a8f98`.
Health: `health-on-track #4cb782`, `health-at-risk #f2c94c`,
`health-off-track #eb5757`.

Use Tailwind classes that reference tokens (`bg-panel`, `text-faint`,
`bg-selected`, `text-status-progress`). Raw hex in feature code is a bug,
with two exceptions: data-driven colors (label/member `color` fields go
through inline `style`) and the icon components in `components/icons/`.

## Type scale

| Class | Size | Use |
|---|---|---|
| `text-2xs` | 11px | Chips, section labels, kbd hints |
| `text-xs` | 12px | Issue ids, timestamps, meta |
| `text-sm` | 13px | Default UI text: rows, nav, buttons, inputs |
| `text-base` | 15px | Dialog titles, issue titles in detail view |
| `text-lg`+ | | Page-level headings only (rare) |

Weight: `font-medium` for interactive text and titles, regular otherwise.
Never bold body copy.

## Recipes

### Page skeleton

Every page renders, in order: one `PanelHeader`, optionally one toolbar row
(`h-10 border-b px-4`), then a scrollable body (`flex-1 overflow-y-auto`).

### List row

`h-10` flex row, `px-4`, `gap-2.5`, `hover:bg-accent`, `cursor-default`.
Order for issue rows: priority icon, id (`w-14 text-xs text-faint`),
status icon, title (`truncate text-sm font-medium`), then right-aligned:
label chips, sprint chip, due date, created date (`text-xs text-faint`),
assignee avatar (18px). Hide the optional right-side fields at narrow
widths with responsive classes rather than wrapping.

### Group header

`h-9` flex row, `px-4`, `gap-2`, `bg-white/[0.03]`: status icon, label
(`text-sm font-medium`), count (`text-sm text-muted-foreground`), spacer,
plus button (`ghost icon-xs`) that opens the new-issue modal with that
group prefilled.

### Property pill (status, priority, assignee, label, sprint, OKR pickers)

A `Button` with `variant="outline" size="xs"`: icon + current value.
Clicking opens a `Popover` containing a `Command` list, item height 32px,
with a check on the selected item. Same component everywhere an issue
property is edited (modal, detail sidebar, toolbar).

### Dialogs

`DialogContent` top-aligned like Linear: add
`className="top-[18%] translate-y-0 p-0 sm:max-w-xl"` and compose the body
manually. New-issue modal: small context row (team badge + "New issue"),
borderless title input (`text-base font-medium`), borderless description
textarea, property pill row, footer with `Create issue` primary button on
the right.

### Chips

Label chips via `LabelChip`. Other meta chips (sprint, estimate) follow the
same shape: `h-[22px] rounded-full border-input px-2 text-2xs
text-muted-foreground` with a 12px icon.

### Progress

Thin bars: `h-1 rounded-full bg-white/10` with a colored fill div. Color by
health for OKRs, `bg-primary` otherwise. Percent text `text-xs
text-muted-foreground`.

### Objective score header (OKR detail)

Under the description: percent (`text-base font-semibold tabular-nums`),
an `h-1` bar filled with the objective's health token, and a caption
(`text-xs text-faint`, "average of n key results").

### Key result row (OKR detail)

`h-10` row: status dot picker (ghost `icon-xs` button holding a
`size-2.5` dot; health tokens for On track / At risk / Off track,
`status-done` for Done), borderless name input committing on blur, `w-24`
progress bar colored by the KR status, percent (`text-xs tabular-nums`),
then the value button (`h-6 rounded-md px-1.5 text-xs tabular-nums`
showing `current / target unit`, hover `bg-accent`) which opens the
update popover: numeric input + slider bound to one draft, commit on
Update or Enter only. Done KRs score 100 and render the name struck
through. Progress direction is fixed when a KR is created, so
lower-is-better metrics stay at 100 after beating their target.

### Activity feed (OKR history)

Sidebar section under a `text-2xs` faint "Activity" label: rows of
`MemberAvatar` sm + event summary (`text-xs leading-relaxed
text-foreground/90`) + relative time (`text-2xs text-faint`). Newest
first, capped at 50. Events are written by store actions only;
components never append history themselves.

### Empty states

Use `EmptyState` with a lucide icon, one-line title, one-line description,
and at most one action.

### Prose (wiki docs)

Wiki content is a markdown subset rendered by
`features/wiki/components/doc-markdown.tsx`: headings, `-` bullet and
`1.` numbered lists (the written start number is preserved),
triple-backtick code fences, paragraphs, and inline `code` /
`**bold**`. A fence opened as three backticks plus `mermaid` renders as
a diagram (dark theme, lazy loaded) via
`features/wiki/components/mermaid-block.tsx`; on parse failure it falls
back to the plain code block. Heading sizes: `##` is the top level and renders `text-lg`
semibold; `###` renders `text-base`; deeper levels render `text-sm`; a
lone `#` folds into `##`. Body text is `text-sm leading-relaxed
text-foreground/90`; code is mono `text-xs` on `bg-white/[0.06]`
(inline) or a bordered `bg-white/[0.03]` block. Editing is the raw
source in a mono textarea; there is no rich text in v0. If docs outgrow
the subset, swap the renderer for a real markdown library rather than
extending the parser piecemeal.

### Icons

Domain glyphs come from `components/icons/` (StatusIcon, PriorityIcon,
HealthIcon). Everything else is lucide with `strokeWidth={1.8}` at
`size-4`. Never mix icon sets for the same concept.

### Motion

Rely on the animations shadcn primitives ship with. No custom motion in v0.
