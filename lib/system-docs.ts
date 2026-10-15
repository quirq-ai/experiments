import type { WikiDoc } from "./types";

/*
  Wiki docs the app seeds and keeps current. On each snapshot load the
  store compares systemDocsVersion with SYSTEM_DOCS_VERSION and, when
  behind, replaces these docs by id (see loadSnapshot in lib/store.ts).
  Bump the version whenever the content here changes. Between bumps they
  are ordinary wiki docs: editable, even deletable until the next bump.
*/

export const SYSTEM_DOCS_VERSION = 2;

const DATA_FLOW_CONTENT = `## How XO data gets into this app

This tracker has no database. Issues, members and projects are a **read
only mirror** of the .xo state files that XO agents and the workspace
operator already write on disk. Sprints, OKRs and the wiki are local to
the browser (localStorage) until they get their own sources.

## The big picture

\`\`\`mermaid
flowchart LR
  subgraph disk [Your disk: XO root]
    T[".xo/todos.json<br/>agent session todos"]
    W[".xo/work-items.json<br/>operator work items"]
    P["project folders/.xo<br/>selected in Setup"]
  end
  subgraph server [linear-clone server]
    R["lib/xo-reader.ts<br/>maps JSON to the domain"]
    S["GET /api/xo/snapshot"]
    F["GET /api/xo/folders"]
  end
  subgraph browser [Browser]
    Z["zustand store<br/>mirror + local slices"]
    U["issue list, projects,<br/>calendar, members"]
    D["Setup dialog"]
  end
  T --> R
  W --> R
  P --> R
  R --> S
  S -->|JSON| Z
  F -->|JSON| D
  Z --> U
\`\`\`

Nothing ever flows right to left. The app never writes a .xo file, so an
agent session can never be corrupted from here.

## Load sequence

\`\`\`mermaid
sequenceDiagram
  participant Page as Page load
  participant Gate as StoreHydrated
  participant LS as localStorage
  participant API as /api/xo/snapshot
  participant Store as zustand store
  Page->>Gate: mount
  Gate->>LS: rehydrate local slices
  Note over LS: sprints, OKRs, wiki,<br/>setup config
  Gate->>API: fetch (root + projects<br/>from setup config)
  API-->>Store: loadSnapshot()
  Note over Store: replaces mirror slices:<br/>workspace, members,<br/>labels, projects, issues
  Gate->>Page: render pages
\`\`\`

Refresh from XO (workspace menu or command palette) reruns the fetch and
loadSnapshot without a reload.

## How records map

\`\`\`mermaid
flowchart LR
  subgraph raw [In .xo files]
    TD["session todo<br/>pending / in_progress / completed"]
    WI["work item<br/>owner, project_id, status"]
    PJ["project.json name"]
    FD["folder selected in Setup"]
  end
  subgraph domain [In the app]
    I1["Issue + Agent todo label"]
    I2["Issue + Work item label"]
    WS["Workspace name"]
    PR["Project"]
  end
  TD --> I1
  WI --> I2
  PJ --> WS
  FD --> PR
\`\`\`

Statuses map directly: pending becomes Todo, in_progress becomes In
Progress, completed becomes Done, anything else lands in Backlog. A work
item's owner becomes the assignee; its project_id routes it to the
matching selected project.

## Where the root comes from

The XO root is one variable with three fallbacks, checked in order:

1. The root set in the **Setup** dialog (persisted in your browser)
2. The \`XO_ROOT\` environment variable in \`.env.local\`
3. The topmost parent folder of this app that contains a \`.xo\` directory

Open Setup from the sidebar to change the root and pick which folders
under it count as projects. The choice is saved locally and used for
every sync after that.

## What is deliberately not here yet

Writing back (two way sync), OKR and sprint sources, and per user data.
The store actions are the seam: when write back lands, the action bodies
change and no page changes.`;

const XO_ANATOMY_CONTENT = `## What lives in a .xo folder

Every XO workspace or project folder can carry a \`.xo\` directory: the
place where agents and the workspace operator persist state between
sessions. It is plain JSON on disk, no daemon, no database. This doc
maps each file and how they reference each other.

\`\`\`
<XO root>/
|- .xo/
|  |- xo.json           agent + capability config
|  |- project.json      identity of this workspace
|  |- workspace.json    project folders + classification
|  |- todos.json        agent session todos
|  |- work-items.json   operator work items
|  |- quirqs.json       budgets and settlement for work items
|  |- activity.json     currently open sessions
|  |- timeline.jsonl    append only event log
|  |- stats.json        aggregated usage stats
|  |- state.json        onboarding flags
|  |- sessions/         per session metadata
|- <project folders>/   each may carry its own .xo/
\`\`\`

## xo.json: the capability switchboard

\`xo.json\` configures what the agent runtime is allowed to use. It has
four top level sections, each a tree of enable flags plus a status block
reporting what is currently healthy:

\`\`\`
{
  "agent": "claude_code",
  "models": {
    "enabled": true,
    "oauth":    { "claude_code": {...}, "codex": {...} },
    "api_keys": { "anthropic": {...}, "openai": {...}, "openrouter": {...} },
    "status":   { "default": "claude_code/claude", "models": [...] }
  },
  "data":     { "google_drive": {...}, "github": {...}, "vercel": {...} },
  "channels": { "telegram": {...}, "slack": {...}, "status": {...} },
  "secrets":  { "enabled": true }
}
\`\`\`

- **models**: which model providers work, via OAuth or API keys, and
  which model is the default
- **data**: connectors the agent may read from (drives, GitHub, Vercel)
- **channels**: where the agent can talk (Slack, Telegram)
- **secrets**: whether the secret store is available

This app does not read xo.json yet; it is the natural source for a
future settings surface.

## The task files and how they link

Three files carry the actual work, and ids stitch them together:

\`\`\`mermaid
flowchart TB
  subgraph todos ["todos.json"]
    SES["sessions keyed by session_id"]
    TODO["todo: id, content, status,<br/>description, active_form"]
    SES --> TODO
  end
  subgraph items ["work-items.json"]
    WI["item: id, content, status,<br/>owner, creator, project_id,<br/>linked_sessions"]
  end
  subgraph quirqs ["quirqs.json"]
    DEF["definition: work_item_id,<br/>budget, checks, token rate"]
    LED["ledger entry: seq,<br/>work_item_id, budget"]
  end
  subgraph ws ["workspace.json"]
    PL["projects list +<br/>classification per folder"]
  end
  subgraph act ["activity.json / sessions/"]
    OS["open_sessions:<br/>session_id, agent, project_id"]
  end
  DEF -->|work_item_id| WI
  LED -->|work_item_id| WI
  WI -->|project_id| PL
  WI -->|linked_sessions| OS
  SES -->|session_id| OS
\`\`\`

Reading the arrows: a quirq definition prices a work item by its id; a
ledger entry settles against the same id. A work item belongs to a
project folder named in workspace.json, and can link to the agent
sessions that worked on it. Todo sessions and open sessions share the
same session ids.

## The three id namespaces

1. **session_id**: created per agent session. Keys todos.json sessions,
   appears in activity.json open_sessions and in a work item's
   linked_sessions.
2. **work item id**: created per operator task. Keys work-items.json
   items and every quirqs.json definition and ledger entry.
3. **project_id**: a folder name under the XO root. Appears in work
   items, workspace.json classification, and activity.json.

## What this app consumes

\`\`\`mermaid
flowchart LR
  A["todos.json"] -->|issues| APP["linear-clone"]
  B["work-items.json"] -->|issues, members,<br/>project routing| APP
  C["project.json"] -->|workspace name| APP
  D["xo.json, quirqs.json,<br/>timeline.jsonl, ..."] -.->|not read yet| APP
\`\`\`

The reader (\`lib/xo-reader.ts\`) touches only the three solid arrows,
read only. Quirq budgets, the timeline, and xo.json config are future
sources: budgets could become issue estimates, the timeline could feed
an activity view, xo.json could back a settings page.`;

export const SYSTEM_WIKI_DOCS: WikiDoc[] = [
  {
    id: "w-xo-data-flow",
    title: "XO data flow",
    content: DATA_FLOW_CONTENT,
    authorId: null,
    createdAt: "2026-08-11",
    updatedAt: "2026-08-11",
  },
  {
    id: "w-xo-anatomy",
    title: "Anatomy of .xo and xo.json",
    content: XO_ANATOMY_CONTENT,
    authorId: null,
    createdAt: "2026-08-11",
    updatedAt: "2026-08-11",
  },
];
