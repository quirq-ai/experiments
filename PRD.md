# linear-clone PRD

For the implementing agent: this doc is the scope contract. Each feature
below is sized to land in one prompt. Read AGENTS.md and docs/ before
coding. Build only what a feature row says; nothing speculative. Keep
this doc concise: new features are added as one row plus, only when
needed, a short spec block.

## Product

The visualizer for XO data: a very simple dashboard that analyzes .xo
project data, plus a very simple work-item tool for tracking work and
progress over time. Local, single user, dark UI in Linear's style.

Context: xo-space (the FastAPI local control plane at localhost:5002)
owns the .xo model. Its watcher ingests every runtime's session logs and
writes the .xo files; it bundles a Space UI (graph, projects
observability drawers, sessions telemetry, chat, wiki) at /space; and it
exposes HTTP APIs including full todo CRUD. This app is the Linear
grade work tracking front end over the same data: richer issue
workflows, sprints, OKRs. It reads files directly today and can adopt
xo-space's APIs later without changing any UI.

## Principles

1. Short, tight feature list. Add nothing that is not required.
2. Read only mirror of .xo files; the app never writes to them.
3. One feature = one prompt = one small diff. Expand specs only on ask.
4. Data model changes go through lib/types.ts and lib/store.ts actions.

## Shipped (v0.2, 2026-08-16)

- Origin panel with Walk replay (request 9 promoted): issue detail shows
  origin kind, session id and source path with copy actions, plus a
  Watch replay link on agent todos that opens space-walk on that exact
  session. Base URL from NEXT_PUBLIC_SPACEWALK_URL, default
  127.0.0.1:8787 (run `spacewalk serve -port 8787`). First seam of the
  Space convergence plan (space-convergence-plan.md at the workspace
  root): work item to session to replay.

## Shipped (v0.1, 2026-08-11)

- XO mirror: .xo todos and work items load as issues via /api/xo
- Setup: editable XO root + folder selection; folders become projects
- Sidebar project tree: each project splits into Work items and Sprints
- Wiki with mermaid diagrams; system docs: data flow, .xo anatomy
- Local only entities: sprints, OKRs, wiki (localStorage)
- This PRD mirrored into the wiki from PRD.md on every sync

## XO data inventory (what exists to visualize)

Per project folder, .xo/ holds:

- project.json: identity plus classification (category, ptype, file
  counts and extensions, last_touched)
- stats.json: rolling 7d and 30d token usage by model, tool call
  counts, files edited, sessions, active minutes; also by_session and
  by_day series
- timeline.jsonl: events (session.started, file.created, file.edited,
  todo.added, todo.completed) with ts, session_id, project_id
- todos.json and sessions/ metadata

The workspace root .xo/ adds: workspace.json (project list plus a
classification of every folder into clusters), work-items.json,
quirqs.json (budget and settlement per work item), activity.json (open
sessions). Shared projects also carry peers.json (collaborator roster)
and sync.json (per peer sync state).

Facts from xo-space (source of truth for this model):

- .xo files are written by xo-space's watcher, which tails each
  runtime's own session logs; agents do not write them directly
- JSON Schemas for every file live in
  xo-space/services/cowork_agent/visualizer/schema/; validate against
  those, not guesses
- Todo statuses are pending, in_progress, completed, cancelled,
  blocked (two more than we map today)
- The canonical projects root is ~/xo-projects (per project: AGENTS.md,
  PROJECT.md, OBJECTIVES.md, PLAN.md, PROGRESS.md, memory/, .xo/);
  ClaudeWorkspace uses the same file format
- HTTP APIs exist: GET /api/xo-projects, /{id}/tree, /{id}/activity,
  and todo CRUD at /api/xo-projects/{id}/todos (flock safe writes)

Mirrored today: todos, work items, project names. Everything else is
untapped; features draw from it one Requests row at a time. If write
back is ever promoted, the safe path is xo-space's todo API, never
writing .xo files ourselves.

## Components (user manual)

Storage classes referenced below:

- disk: .xo files under the XO root. Source of truth. The app only reads them.
- local: browser localStorage. Survives reloads; lives only in that browser.
- memory: this tab only. Lost on reload or next sync. Honest v0 gap until write back lands.
- derived: computed from the above; nothing stored.

### .xo data source

What: agent state on disk feeds the app: todos.json (agent session todos) and work-items.json (operator work items), from the root and each selected project folder.
Interact: not editable in the app. Sync via Refresh from XO (workspace menu or Cmd K) or a reload.
Stored: disk.
Expected: every sync rebuilds issues, projects, members and tags from the files; in-app edits to mirrored data disappear on the next sync.

### Setup

What: picks the XO root and which top level folders count as projects.
Interact: sidebar footer button, workspace menu, or Cmd K. Edit the root path, Load, tick folders, Save and sync.
Stored: local (xoConfig).
Expected: root falls back to the XO_ROOT env var, then the topmost folder above the app containing .xo. Folders with their own .xo show a badge in the list.

### Projects

What: each selected folder, plus the root as "Workspace". Sidebar entries expand into Work items and Sprints.
Fields: id, name, folder (empty string means the workspace root), color. Workspace identity fields: name, teamKey (the issue prefix in XO-n), teamName, color.
Interact: expand or collapse; open either child view. New issue from a project view pre-fills that project.
Stored: derived (disk + Setup selection).
Expected: work items route to a project by folder, and by project_id for root level work items.

### Work items (issues)

What: every todo and work item mirrored as an issue, numbered XO-n, grouped by status.
Fields: id, number, title, description, status, priority, assigneeId, labelIds, projectId, sprintId, objectiveId, estimate, dueDate, createdAt, updatedAt, and origin (kind agent_todo or work_item, sourcePath, sessionId) on mirrored issues.
Vocabularies: status is backlog, todo, in_progress, in_review, done, canceled. Priority is none, urgent, high, medium, low. Estimate is 1, 2, 3, 5 or 8.
Interact: open detail from a row; edit status, priority, assignee, tags, sprint, OKR, estimate, due date; create with C or New issue; delete from detail. Mirrored issues also show an Origin panel: kind, session id and source path (copyable), and agent todos get a Watch replay link that opens space-walk on that session.
Stored: memory (edits to mirrored items and newly created items both).
Expected: status maps pending to Todo, in_progress to In Progress, completed to Done, anything else to Backlog. Numbers are assigned per sync and can shift as data grows.

### Tags (labels)

What: two fixed source tags, Agent todo and Work item, auto applied by the mirror.
Fields: id, name, color.
Interact: filter by tag in the issues filter bar; assign or remove in pickers.
Stored: derived; tag assignments on mirrored issues are memory.
Expected: no user created tags yet (promote via Requests if needed).

### Sprints

What: timeboxed batches, workspace wide; each project's Sprints view scopes them to that project's issues.
Fields: id, number (sequential), name ("Sprint N"), goal (optional), startDate and endDate (ISO dates, inclusive).
Interact: create with New sprint (goal, dates), edit, delete; assign issues via pickers.
Stored: local. Issue-to-sprint assignments on mirrored issues are memory.
Expected: active, upcoming or completed derives from dates; completion is done over non-canceled issues.

### OKRs

What: objectives with key results, health, owner and target date.
Fields, objective: id, name, description (optional), ownerId, health (on_track, at_risk, off_track), targetDate (ISO date), keyResults, createdAt.
Fields, key result: id, name, current, target, unit (optional display unit such as "%" or "min").
Progress math: key result progress is current over target, capped 0 to 100; when target is below current the ratio inverts so decreasing targets (latency, cost) work; a target of 0 scores 100 only when current is 0. Objective progress is the plain average of its key results.
Interact: create an objective, add or edit key results (current and target), set health, link issues via the OKR picker.
Stored: local. Issue links on mirrored issues are memory.
Expected: objective progress is the average of key result progress; decreasing targets (latency, cost) are supported.

### Wiki

What: markdown docs with mermaid diagram support. System docs: XO data flow, Anatomy of .xo and xo.json, and PRD (this doc).
Fields: id, title, content (markdown subset), authorId (null for system docs or removed authors), createdAt, updatedAt.
Interact: create, edit as raw markdown, delete.
Stored: local, except PRD, which mirrors PRD.md from disk on every sync.
Expected: system docs refresh when their version bumps; wiki edits to PRD are overwritten on sync, edit PRD.md instead. A mermaid code fence renders as a diagram.

### Members

What: people derived from work item creators and owners, plus the operator.
Fields: id, name, email, role (Admin or Member), color, joinedAt.
Interact: invite adds a member; removing one unassigns their issues.
Stored: memory (mirror slice; invites vanish on the next sync).
Expected: Workspace operator stands in for the signed-in user until Clerk mapping lands. My Issues shows the operator's items, which includes all agent todos.

### Calendar

What: month grid of sprint spans, OKR target dates and issue due dates.
Interact: navigate months; entries link to their items.
Stored: derived.
Expected: mirrored issues carry no due dates yet, so entries come mostly from local sprints and OKRs.

### Inbox and My Issues

What: Inbox is a notifications placeholder; My Issues filters issues to the current member.
Stored: derived.
Expected: Inbox stays empty until notifications get promoted out of non-goals.

### Command palette and hotkeys

What: Cmd or Ctrl K opens the palette: navigate, search issues, docs, sprints and OKRs, New issue, Refresh from XO, Setup. C creates an issue from anywhere.
Stored: not applicable.
Expected: search matches titles; actions close the palette.

## Scope: next up

### F1: Dashboard (promoted 2026-08-11)

- Route `/dashboard`, nav item at the top of the sidebar Workspace section
- Three cards, read only, no new dependencies (bars are plain divs per DESIGN.md):
  1. Open vs done per project: counts from mirror issues, one row per project
  2. Completed per week: `todo.completed` events from `.xo/timeline.jsonl`
     (fields: ts, type, project_id), last 8 weeks; parse in lib/xo-reader.ts,
     expose weekly counts in the snapshot
  3. Stale items: open work items with updatedAt older than 14 days

## Requests

- 1. Dashboard analyzing XO project data [next]: spec above (F1)
- 2. Work-item progress over time [parked]: card 2 of F1 covers the trend; per-item history still parked

Per component pairs (one UX, one architecture), added 2026-08-12:

- 3. Sync status pill (.xo data source, UX) [parked]: sidebar shows last synced time, source counts, and surfaces syncError instead of failing silently
- 4. Schema aligned reader (.xo data source, arch) [parked]: validate parsed files against xo-space's JSON schemas; map cancelled to Canceled and blocked distinctly instead of Backlog
- 5. Root suggestions (Setup, UX) [parked]: offer detected roots (~/xo-projects, .xo ancestors) as one click choices instead of typing paths
- 6. Root provenance (Setup, arch) [parked]: one shared root resolution module; API echoes which fallback won (setup, env, ancestor) and Setup displays it
- 7. Project overview header (Projects, UX) [parked]: surface project.json classification (category, ptype, last_touched) and counts on the project pages
- 8. Stable project identity (Projects, arch) [parked]: one ensureProject seam keyed by folder path; ids stable across syncs, no folder vs project_id collisions
- 9. Origin panel (Work items, UX) [shipped 2026-08-16]: issue detail shows source file, session id and kind from the existing origin field, with copy path; extended with a Watch replay link into space-walk
- 10. Local edits overlay (Work items, arch) [parked]: persist in app edits to mirrored issues in a localStorage overlay keyed by origin id, reapplied after each sync; closes the memory class gap without write back
- 11. User created tags (Tags, UX) [parked]: create, rename, recolor tags; persisted locally
- 12. Unified labels slice (Tags, arch) [parked]: merge mirror tags and local tags into one store slice with a source flag and one selector path
- 13. Assign from sprint detail (Sprints, UX) [parked]: bulk add issues to a sprint from the sprint page instead of issue by issue pickers
- 14. Shared sprint row (Sprints, arch) [parked]: consolidate the duplicated SprintRow and ProjectSprintRow into one components/shared component fed by selectors
- 15. Objective detail linking (OKRs, UX) [parked]: link and unlink work items from the objective page; show linked issue completion next to key results
- 16. Memoized OKR selectors (OKRs, arch) [parked]: progress and health math computed in one selectors module reused by list, detail and calendar
- 17. Doc outline (Wiki, UX) [parked]: auto table of contents from headings, sticky beside the doc
- 18. Managed docs module (Wiki, arch) [parked]: generalize system doc seeding and the PRD mirror into one managed docs registry with per doc versioning
- 19. Member detail (Members, UX) [parked]: per member issue counts and recent items on the members page
- 20. Stable member identity (Members, arch) [parked]: consolidate creator and owner derivation with slug collision handling; local invites survive sync via the overlay
- 21. Activity heat (Calendar, UX) [parked]: shade days by todo.completed counts from timeline.jsonl so the month shows real work rhythm
- 22. Single event source (Calendar, arch) [parked]: one selector flattens sprints, OKR targets and due dates into typed events; cells stop filtering raw slices
- 23. Change inbox (Inbox and My Issues, UX) [parked]: Inbox lists items new or changed since your last visit, read only, from sync diffs
- 24. Current member seam (Inbox and My Issues, arch) [parked]: one useCurrentMember source of truth feeding My Issues, avatars and wiki authorship; the future Clerk mapping point
- 25. Deeper search (Command palette, UX) [parked]: palette matches project names and issue descriptions, recent items ranked first
- 26. Command registry (Command palette, arch) [parked]: sidebar nav and palette commands defined once in a shared module instead of duplicated lists

## Non-goals (until explicitly promoted)

Write back to .xo, auth/user mapping, comments, notifications, drag and
drop, board view, light theme, mobile.
