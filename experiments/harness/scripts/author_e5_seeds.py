#!/usr/bin/env python3
"""
author_e5_seeds.py — populate the E5 pre-seeded memory for every task.

Background: the E5 condition is "full XO scaffold + seeded episodic memory". The
seed directories under harness/e5_seeds/<task>/memory/ shipped EMPTY (0-byte
placeholders), which meant E5 actually had *less* memory than E4 (the empty
files overwrote E4's template semantic memory on merge). This script writes
curated, codebase-grounded seed memory so E5 is a real, well-defined condition.

Design (mirrors the XO memory model):
  - semantic/   : durable, task-independent knowledge of THIS repo. Shared across
                  all tasks (a prior agent that worked here would know the same
                  architecture). Same 3 files for every task.
  - episodic/   : 2 narratives of prior sessions worked NEAR this task's area —
                  this is the task-relevant "head start" E5 is meant to provide.
  - procedural/ : 1 reusable how-to relevant to this task.

Content is grounded in the repo at BASE_SHA (4e09644). It is hand-curated rather
than produced by a live agent (cf. seed_e5_memory.sh) so the E5 intervention is
consistent and reproducible across tasks. Re-run any time; it overwrites.

Usage:  python3 harness/scripts/author_e5_seeds.py
"""
from __future__ import annotations
import os
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]          # experiments/
SEEDS = HERE / "harness" / "e5_seeds"

# ── Shared semantic memory (identical for every task) ────────────────────────

SEMANTIC = {
"project-facts.md": """# Project facts — xo-cowork-api

Durable architecture facts (learned over prior sessions in this repo).

- FastAPI backend. The app is built in `server.py` (`app = FastAPI(...)`, around
  line 542) with a `lifespan` context manager that runs ~20 startup steps.
- Routers live under `routers/`, split into three domains: `auth/`, `status/`,
  `cowork_agent/`. Each route module exposes a single `router: APIRouter`.
- Router assembly is EXPLICIT in `server.py` (~lines 562-573): auth/status/setup
  routers are mounted with `app.include_router(...)`; the cowork_agent routers
  come from `routers/cowork_agent/__init__.py`, which exports
  `all_routers: list[APIRouter]` and is mounted in a loop. There is NO
  auto-discovery — adding a router means importing it and adding an include call.
- APIRouter convention: prefixed routers like `APIRouter(prefix="/xo-auth",
  tags=["auth"])`, `APIRouter(prefix="/models", tags=["models"])`. The core
  `/api/*` routes use a bare `APIRouter()` and put the full path on the decorator
  (e.g. `@router.post("/api/chat/prompt")`).
- `services/` holds business logic. The agent-extension seam is
  `services/cowork_agent/adapters/` (base.py, loader.py); agent-specific behavior
  is resolved at runtime via `load_capability(...)` / `try_load_capability(...)`
  keyed on `AGENT_NAME`. Core code must stay agent-agnostic.
- Storage is FILE-BASED, not SQL: session transcripts at `~/.claude/projects/*/*.jsonl`,
  project state under `~/xo-projects/<id>/.xo/`, sync watermarks under `data/<agent>/...json`.
- The only middleware registered today is `CORSMiddleware` (added right after the
  app is created, before routers are included). No logging or auth middleware.
- Incoming HTTP requests are NOT authenticated by an Authorization header. The
  `routers/auth/` code is about OUTBOUND calls to xo-swarm-api, using either the
  static `XO_API_KEY` env var or an in-memory "consume" session token.
""",

"constraints.md": """# Constraints — house rules (AGENTS.md / CLAUDE.md / DEVELOPING.md)

- MODULARITY INVARIANT: no core file may hard-code a specific agent name
  (`openclaw` / `hermes` / `claude_code`). Anything agent-specific resolves through
  `services/cowork_agent/adapters/loader.py`. (DEVELOPING.md §6; small documented
  exception allowlist exists.)
- Preserve request/response contracts unless the task explicitly says to change
  them. Backward compatibility is sacred. (DEVELOPING.md §7)
- NEVER log or print secrets, tokens, API keys, or credentials.
  (CLAUDE.md: "Avoid logging sensitive values".)
- The project folder is sacred: never write chat content, credentials, or anything
  that wouldn't survive a `git push` into `~/xo-projects/<id>/`. (DEVELOPING.md §7)
- Keep route handlers thin — business logic belongs in `services/`.
- Keep edits minimal and targeted: one concern at a time.
- Use async patterns for network/subprocess work (httpx.AsyncClient, asyncio.subprocess).
- Validation playbook (DEVELOPING.md §5): import gate + route parity (claude_code /
  openclaw / hermes ≈ 146 / 149 / 173 routes) + modularity check.
""",

"preferences.md": """# Preferences — observed coding style

- New endpoint? Follow the existing router in its domain: create/extend a module
  under `routers/<domain>/`, define `router = APIRouter(prefix=..., tags=[...])`,
  then register it (server.py include_router, or add to `all_routers` for
  cowork_agent). Mirror a neighbouring handler's shape.
- Status endpoints delegate external-service checks to agent adapters via
  `load_capability("<x>_status")` rather than probing services directly.
- Tests: there is NO `tests/` dir at this commit and no pytest config. The fitting
  idiom is `from fastapi.testclient import TestClient; client = TestClient(app)`
  (sync); use `httpx.AsyncClient` for async handlers. You must add pytest yourself.
- OpenAPI docs come from function docstrings (FastAPI uses the first line as the
  summary, the rest as the description) — not `summary=`/`description=` kwargs.
- Prefer editing in place over rewrites; match surrounding style. Existing
  diagnostics are emoji-prefixed `print()` in server.py and
  `logging.getLogger(__name__)` in connector modules.
""",
}

# ── Per-task episodic (2) + procedural (1) ───────────────────────────────────
# Each episode: (filename, frontmatter-tags, outcome, what, why, how).
# Each procedural: (filename, trigger, steps[list], gotchas[list]).

def ep(date, slug, tags, outcome, what, why, how):
    fm = f"---\ndate: {date}\ntags: [{', '.join(tags)}]\noutcome: {outcome}\n---\n"
    return (f"{date}-{slug}.md",
            f"{fm}\n## What\n{what}\n\n## Why it mattered\n{why}\n\n## How it went\n{how}\n")

def proc(slug, trigger, steps, gotchas, validated="2026-05-30"):
    s = "\n".join(f"{i}. {x}" for i, x in enumerate(steps, 1))
    g = "\n".join(f"- {x}" for x in gotchas)
    return (f"{slug}.md",
            f"---\nname: {slug}\ntrigger_when: {trigger}\n---\n\n## Steps\n{s}\n\n"
            f"## Gotchas\n{g}\n\n## Last validated\n{validated}\n")

TASKS: dict[str, dict] = {

"T01": {"episodes": [
  ep("2026-05-20", "explore-status-routers", ["status", "routing", "fastapi"], "success",
     "Mapped how `routers/status/` is organized while adding a status endpoint.",
     "The next status/health work needs the exact registration path; getting it wrong means the route 404s.",
     "Each status concern is its own module (providers.py, models.py, channels.py) with "
     "`router = APIRouter(prefix=\"/X\", tags=[\"X\"])` exposing `@router.get(\"/status\")` -> path `/X/status`. "
     "Handlers resolve `agent = resolve_agent_name()` then `load_capability(\"<x>_status\", agent=agent)` and "
     "map a `CliStatusError.code` to an HTTP status. External checks live in the agent adapter, NOT the router."),
  ep("2026-05-28", "router-not-autodiscovered", ["routing", "server", "gotcha"], "partial",
     "Added a new status router but the endpoint 404'd until I registered it.",
     "Router registration is manual here — a recurring trap.",
     "Routers are mounted explicitly in `server.py` around lines 566-568 via `app.include_router(...)`. "
     "Importing the module is not enough; I had to add the include_router call. After that the route resolved."),
 ],
 "procedural": proc("add-status-or-health-endpoint",
   "asked to add an endpoint under routers/status/ (e.g. a health/deep check)",
   ["Create a module in `routers/status/` with `router = APIRouter(prefix=\"/health\", tags=[\"health\"])`.",
    "Expose the handler, e.g. `@router.get(\"/deep\")` so the full path is `/health/deep`.",
    "Discover external services from env vars; check connectivity; return "
    "`{\"status\": ok|degraded|down, \"services\": {name: status}}`. ok=all up, down=all fail, else degraded.",
    "Register it: import the router in `server.py` and add `app.include_router(<router>)` near the other status routers (~line 566).",
    "Add a test under tests/ using `TestClient(app)` (create the dir; pytest isn't configured)."],
   ["Routers are NOT auto-discovered — you must add the include_router call in server.py.",
    "Never put service URLs or credentials in the response — names + status only.",
    "Status endpoints conventionally delegate to adapters via load_capability; a self-contained probe is fine for /health/deep but keep it agent-agnostic."]),
},

"T02": {"episodes": [
  ep("2026-05-18", "map-auth-token-flow", ["auth", "tokens"], "success",
     "Traced how `routers/auth/auth.py` obtains the token used for outbound calls.",
     "Touching auth safely requires knowing which token is which — there are three unrelated ones.",
     "`get_auth_token()` returns `XO_API_KEY` if set, else the in-memory consume-flow `access_token`. "
     "`ChatAPIClient._headers()` builds `{\"Authorization\": f\"Bearer {token}\"}` for xo-swarm-api. "
     "Separately, claude_setup_token.py captures the Claude CLI OAuth token and codex_setup.py the Codex token — never cross them."),
  ep("2026-05-25", "header-extract-helper", ["auth", "http", "parsing"], "success",
     "Wrote a small helper to pull a token out of an Authorization header.",
     "Clients send either `Bearer <t>` or a raw `<t>`; inconsistent stripping caused a bug.",
     "Header lookups must be case-insensitive (`request.headers.get(\"authorization\")`). I normalized by "
     "checking `.startswith(\"Bearer \")` and using `removeprefix(\"Bearer \")`, falling back to the raw value, then `.strip()`."),
 ],
 "procedural": proc("parse-authorization-header",
   "extracting a token from an incoming Authorization header",
   ["Read the header case-insensitively: `auth = request.headers.get(\"authorization\", \"\")`.",
    "If it starts with `\"Bearer \"`, strip exactly that prefix: `token = auth.removeprefix(\"Bearer \").strip()`.",
    "Otherwise treat the whole value as the raw token (also `.strip()`).",
    "Centralize this in one helper and call it everywhere a token is read; add a test for both formats."],
   ["Header names are case-insensitive — don't index `headers[\"Authorization\"]` assuming exact case.",
    "Don't split on whitespace blindly; tokens can't contain spaces but be explicit about the `Bearer ` prefix.",
    "Never log the token value. There is no incoming-auth middleware today, so the fix is wherever a token is consumed."]),
},

"T03": {"episodes": [
  ep("2026-05-15", "map-chat-endpoints", ["chat", "routing"], "success",
     "Located the chat endpoints and their lifecycle.",
     "Rate limiting must cover the right paths without breaking the streaming flow.",
     "Chat routes are `@router.post(\"/api/chat/prompt\")`, `/api/chat/abort`, `/api/chat/respond` on a bare "
     "`APIRouter()` in `routers/cowork_agent/chat.py`. POST /api/chat/prompt returns a stream_id; the client then "
     "polls GET /api/chat/stream/{id} (SSE). State lives in a process-local dict (single-worker only)."),
  ep("2026-05-22", "add-middleware-in-server", ["middleware", "server"], "success",
     "Added a FastAPI middleware in server.py and learned the ordering rules.",
     "Middleware added in the wrong place either misses routes or breaks CORS.",
     "Middleware is registered with `app.add_middleware(...)` after the app is created and BEFORE routers are "
     "included (~lines 555-561, currently only CORSMiddleware). A path-scoped limiter can early-return a "
     "`JSONResponse(status_code=429, ...)` for matching paths and pass everything else through."),
 ],
 "procedural": proc("add-fastapi-middleware-or-dependency",
   "adding cross-cutting behavior (rate limiting, auth) to a set of routes",
   ["Decide scope: middleware (covers all requests, filter by `request.url.path`) vs a router dependency (per-route).",
    "For /api/chat/* rate limiting, an ASGI/HTTP middleware keyed on `request.client.host` with an in-memory "
    "sliding window (deque of timestamps per IP) is simplest; no Redis needed.",
    "Read the limit from env (`RATE_LIMIT_RPM`, default 10). On exceed, return "
    "`JSONResponse(429, {\"error\": \"rate_limit_exceeded\", \"retry_after\": <s>})`.",
    "Register with `app.add_middleware(...)` in server.py after app creation; ensure non-chat paths are untouched.",
    "Test: 10 pass, 11th in a minute -> 429, resets after the window."],
   ["In-memory state assumes a single uvicorn worker (the repo already relies on this for chat state).",
    "Only affect /api/chat/* — guard on the path prefix so other routes are unaffected.",
    "Don't rate-limit the SSE stream polling so aggressively that a normal conversation breaks."]),
},

"T04": {"episodes": [
  ep("2026-05-12", "map-scopes-module", ["scopes", "refactor", "bff"], "success",
     "Read `services/cowork_agent/scopes.py` end to end before touching it.",
     "A dataclass refactor must keep `resolve_scope` and every call site working.",
     "The module exposes `resolve_scope(name, *args) -> ScopeHandle` (a Union of `Path | SecretsScope | "
     "VisualizerScope | WorkspaceVisualizerScope`). `_XoReader` is a base with class-level filename constants "
     "(`_STATS`, `_TODOS`, ...). Call sites in `routers/cowork_agent/bff/` always go through `resolve_scope(...)`."),
  ep("2026-05-19", "normalize-id-guard", ["security", "scopes"], "success",
     "Noticed VisualizerScope normalizes its project_id in __init__.",
     "Dropping that during a refactor would reopen a path-traversal hole.",
     "`VisualizerScope.__init__` runs `normalize_agent_id(project_id)` before storing/using it (defense against "
     "`../etc`). Any dataclass `__post_init__` must keep this normalization and any required-field validation."),
 ],
 "procedural": proc("refactor-class-to-dataclass-safely",
   "converting plain classes/dicts to dataclasses without breaking callers",
   ["Inventory the public surface first: exported classes, `resolve_scope`'s signature, field names, return shapes.",
    "Grep for every importer/caller (here: `routers/cowork_agent/bff/*`) and note how they construct/access scopes.",
    "Introduce `@dataclass` with typed fields matching the current data; move existing `__init__` logic "
    "(e.g. id normalization) into `__post_init__`; add validation for required-non-empty fields.",
    "Keep method names, the `resolve_scope(name, *args)` dispatch, and return types identical.",
    "Run/import-check; if no tests exist, exercise the BFF routes that call resolve_scope."],
   ["Preserve `normalize_agent_id()` on project_id — it's a path-traversal guard, not incidental.",
    "`_XoReader` uses CLASS-level constants read as `self._xo_root / self._STATS`; keep class-var precedence.",
    "Do not change `resolve_scope`'s variadic `*args` contract — call sites pass 0 or 1 extra arg."]),
},

"T05": {"episodes": [
  ep("2026-05-16", "read-workspace-memory", ["tests", "workspace-memory"], "success",
     "Read `routers/cowork_agent/workspace_memory.py` before writing tests.",
     "Tests should match the actual handler shapes and the (currently stubbed) behavior.",
     "It defines `router = APIRouter()` (no prefix) with `/api/workspace-memory` GET/PUT/DELETE, "
     "`/api/workspace-memory/list` GET, `/refresh` and `/export` POST. Five handlers are sync, "
     "`workspace_memory_update(request: Request)` is async. Handlers are stubs returning static values; "
     "`workspace_path` is an optional, currently-unused query param."),
  ep("2026-05-24", "first-testclient-suite", ["tests", "pytest", "scaffolding"], "partial",
     "Stood up the first pytest suite in a repo that had none.",
     "There's no tests/ dir or pytest config, so the harness has to be created from scratch.",
     "Created tests/ and used `from fastapi.testclient import TestClient; client = TestClient(app)` importing the "
     "app from server.py. Sync handlers work directly with TestClient; the one async handler also works through it. "
     "Had to `pip install pytest` — it isn't in requirements.txt."),
 ],
 "procedural": proc("write-fastapi-route-tests",
   "writing a pytest suite for a router module",
   ["Read the module: list every route, method, path, and which handlers are async vs sync.",
    "Create `tests/test_<module>.py`; build a client with `TestClient(app)` (import app from server.py).",
    "Cover happy path + error/edge for each handler; for stubbed handlers assert the static response shape.",
    "Mock filesystem/DB/external calls with monkeypatch or tmp_path; keep at least 3 distinct test functions.",
    "Ensure pytest is available (not in requirements.txt); run `pytest tests/ -q`."],
   ["No tests/ dir or pytest config exists at this commit — create them.",
    "`workspace_memory_update` is async but TestClient handles it fine; no need for AsyncClient unless you prefer it.",
    "Handlers are stubs today; don't assert real persistence behavior that isn't implemented yet."]),
},

"T06": {"episodes": [
  ep("2026-05-14", "files-list-shape", ["files", "api"], "success",
     "Pinned down the file-listing endpoint's real shape.",
     "Pagination has to extend the response without breaking existing clients.",
     "It's `@router.post(\"/api/files/list-directory\")` (POST, not GET) in `routers/cowork_agent/files.py`, "
     "reading a JSON body `{\"path\": ...}` and returning `{path, parent, dirs, files}` where dirs/files are "
     "`{name, path}` lists, sorted in Python by `(not is_dir, name.lower())`. Listing is currently unbounded."),
  ep("2026-05-21", "sessions-offset-precedent", ["pagination", "sessions"], "success",
     "Found existing pagination precedent in sessions.py.",
     "Reusing the house pattern keeps the new pagination consistent.",
     "`GET /api/sessions` already paginates with `limit: int = 50, offset: int = 0` and slices "
     "`all[offset:offset+limit]`. There's even a TODO noting a future cursor-pagination pass. A cursor that "
     "base64-encodes the integer offset fits cleanly on top of this offset model."),
 ],
 "procedural": proc("add-cursor-pagination",
   "adding cursor-based pagination to a list endpoint",
   ["Add params: `limit` (default 50, cap 500) and optional opaque `cursor` (base64 of an int offset).",
    "Decode cursor -> offset (default 0); slice the sorted result `items[offset:offset+limit]`.",
    "Compute `next_cursor` = base64(offset+limit) when more remain, else null; add it alongside existing fields.",
    "Stay backward compatible: no cursor/limit -> behave as before (or full list / first page).",
    "Test: page 1 returns a next_cursor; page 2 via that cursor returns different items; last page returns null."],
   ["The endpoint is POST with a JSON body — add the params to the body (or query) consistently; don't silently switch to GET.",
    "Filesystem ordering can shift between calls; sort stably before slicing so cursors stay meaningful.",
    "Keep the existing response fields; only ADD `next_cursor`."]),
},

"T07": {"episodes": [
  ep("2026-05-13", "project-scaffold-model", ["projects", "idempotency"], "success",
     "Mapped how projects get created and what identifies them.",
     "Idempotent creation needs the real unique key and the existing create path.",
     "`scaffold_project(name, *, display_name, description)` in `services/cowork_agent/project_layout.py` copies a "
     "template (file-copy is already idempotent) and `_upsert_metadata` writes `.xo/project.json` "
     "({name, display_name, description, created_at}) — created_at is set once and never overwritten. The unique key "
     "is the normalized project id (folder name under ~/xo-projects/). There is no unified POST create endpoint yet."),
  ep("2026-05-23", "create-agent-409", ["projects", "http", "status-codes"], "success",
     "Saw the existing duplicate-handling on the agent side.",
     "It shows the intended idempotency semantics and a status-code precedent.",
     "`create_agent()` (claude_code adapter) checks `_load(agent_id)` and returns HTTP 409 when the agent record "
     "already exists. Note the agent record and the project FOLDER are separate concerns — idempotency keys off the record/id."),
 ],
 "procedural": proc("make-create-idempotent",
   "making a create operation idempotent (return existing instead of duplicating/erroring)",
   ["Identify the unique key (here: the normalized project id / agent id).",
    "On create: check existence first (`project_exists(name)` / `_load(id)`) BEFORE scaffolding.",
    "If found: return the existing entity with HTTP 200 and header `X-Created: false`.",
    "If new: create as before and return with `X-Created: true` (201 for genuinely new).",
    "Preserve all existing behavior for new projects; add a test that creates twice and asserts same entity + codes."],
   ["created_at is immutable in _upsert_metadata — don't reset it on a repeat call.",
    "The project folder can exist without an agent record (and vice-versa) — pick the key deliberately.",
    "There's no unified create endpoint today; you may need to add one (e.g. POST /api/xo-projects) wired to project_layout."]),
},

"T08": {"episodes": [
  ep("2026-05-11", "logging-audit", ["logging", "structlog", "audit"], "success",
     "Audited current logging before introducing structlog.",
     "Knowing where prints concentrate scopes the migration and avoids missing config.",
     "~122 `print()` calls (≈65 in server.py, ≈31 in routers/auth/claude_setup_token.py, rest scattered) plus ~26 "
     "stdlib `logging.getLogger(__name__)` usages in connectors/visualizer. No central logging config anywhere. "
     "`structlog` is NOT in requirements.txt. Server startup is print-heavy (emoji-prefixed diagnostics in lifespan)."),
  ep("2026-05-26", "no-secret-logging", ["security", "logging"], "success",
     "Reconfirmed the don't-log-secrets rule while planning log replacement.",
     "Structured logs make it easy to accidentally bind a token into context.",
     "CLAUDE.md says avoid logging sensitive values. claude_setup_token.py prints PTY/session state and codex_setup "
     "handles tokens — when converting these, log presence/source/returncode, never the token. Bind a request_id, not auth."),
 ],
 "procedural": proc("introduce-structured-logging",
   "replacing print/stdlib logging with structlog",
   ["Add `structlog` to requirements.txt.",
    "Configure structlog once at startup (a `config/logging.py` helper or top of server.py): JSON renderer when "
    "`LOG_FORMAT=json`, console renderer otherwise.",
    "Replace `print(...)` in routers/ and services/ with `log = structlog.get_logger(); log.info/warning/error(...)`, "
    "choosing levels deliberately; migrate existing `logging.getLogger` call sites too.",
    "Add a middleware that binds a `request_id` into the log context per request.",
    "Verify the app still imports and starts; spot-check that no token/credential is logged."],
   ["Don't place the logging config under config/agents/<name>/ or config/models/<name>/ — those are per-agent boundaries.",
    "Preserve useful startup diagnostics (consider debug level) — server.py relies on them for observability.",
    "Never bind tokens/credentials into structlog context; request_id and source/returncode are fine."]),
},

"T09": {"episodes": [
  ep("2026-05-17", "usage-sync-map", ["usage", "performance", "n+1"], "success",
     "Read the usage sync path to find repeated per-file work.",
     "The N+1 here is a per-item file scan, not a SQL loop — easy to miss.",
     "`services/usage_sync.py` delegates to the active agent's usage module. In "
     "`services/cowork_agent/adapters/usage_common.py`, `get_session(session_id)` loops over EVERY discovered "
     "session file doing a filename substring match (O(N) file ops to find one). `aggregate_for_sync` parses all "
     "files then filters by since_date afterward. The store is file-based JSONL, no DB."),
  ep("2026-05-27", "watermark-after-parse", ["usage", "performance"], "partial",
     "Spotted that the date watermark is applied too late.",
     "Filtering after parsing every file wastes the watermark's benefit.",
     "`aggregate_for_sync` calls `parse_file(sf)` for all files, THEN drops entries older than since_date. Pushing the "
     "date filter into discovery/parse (skip files/entries before the watermark) cuts the work. The fix for get_session "
     "is to build a session_id -> path index once instead of rescanning."),
 ],
 "procedural": proc("fix-n-plus-1-file-scan",
   "removing an N+1 / repeated-scan pattern over per-item files",
   ["Locate the loop that does one fetch/read per item inside a larger loop (here: get_session's linear filename scan).",
    "Replace it with a single bulk pass: build an index (session_id -> filepath) during discovery, then O(1) lookups.",
    "Where a watermark exists (since_date), push the filter to the source so you skip files/entries before parsing them.",
    "Keep the public interface and data semantics identical (sync_payload / list_sessions / get_session shapes).",
    "Add a comment explaining what the N+1 was and how it was resolved."],
   ["This is a FILE-based N+1 (per-file stat+read), not a SQL one — the fix is an index/bulk read, not a JOIN.",
    "Don't change return shapes — usage endpoints and the sync POST depend on them.",
    "Watch the dedup-by-message-id logic when batching; don't double-count entries."]),
},

"T10": {"episodes": [
  ep("2026-05-10", "openapi-docstring-convention", ["openapi", "docs", "fastapi"], "success",
     "Confirmed how this repo expresses OpenAPI docs.",
     "Matching the house convention keeps the generated schema consistent.",
     "No route uses `summary=`/`description=` kwargs — FastAPI derives them from the handler DOCSTRING (first line = "
     "summary, rest = description). auth/* and status/* handlers are fully documented; chat.py and sessions.py are "
     "only ~30-40% documented (most POST/GET/PATCH/DELETE there have no docstring) — that's the gap to fill."),
  ep("2026-05-29", "doc-only-import-gate", ["docs", "validation"], "success",
     "Even a docs-only change has to pass the import gate.",
     "It's easy to break a module with a stray docstring/indentation slip.",
     "After adding docstrings I ran the import gate (import the app / parse the routers) to confirm nothing broke. "
     "Doc-only means NO logic changes — only docstrings or summary/description kwargs."),
 ],
 "procedural": proc("document-route-handlers",
   "adding OpenAPI summaries/descriptions to undocumented route handlers",
   ["Enumerate handlers in routers/cowork_agent/, routers/auth/, routers/status/ and flag those with no docstring "
    "and no summary=/description=.",
    "For each, add a docstring: first line = concise summary; following 2-4 sentences = description of params/behavior. "
    "(Equivalently use summary=/description= on the decorator — but match the docstring convention used here.)",
    "Change DOCS ONLY — no logic edits.",
    "Verify the app still imports cleanly (import gate) and the OpenAPI schema now includes the descriptions."],
   ["FastAPI reads the docstring: first line -> summary, remainder -> description. Keep that shape.",
    "Don't touch handler logic — this is documentation only.",
    "auth/* and status/* are mostly already documented; focus on chat.py and sessions.py."]),
},
}


def write(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def main():
    for task_id, spec in TASKS.items():
        base = SEEDS / task_id / "memory"
        # Clear any stale placeholder files in the three memory kinds.
        for kind in ("semantic", "episodic", "procedural"):
            d = base / kind
            if d.exists():
                for f in d.glob("*.md"):
                    f.unlink()
        # semantic (shared)
        for name, content in SEMANTIC.items():
            write(base / "semantic" / name, content)
        # episodic (task-specific, 2)
        for name, content in spec["episodes"]:
            write(base / "episodic" / name, content)
        # procedural (task-specific, 1)
        pname, pcontent = spec["procedural"]
        write(base / "procedural" / pname, pcontent)
        # refresh the seed README
        write(SEEDS / task_id / "README.md",
              f"# E5 seed memory for {task_id}\n\n"
              "Curated, codebase-grounded seed memory (semantic + 2 episodic + 1 procedural).\n"
              "Generated by harness/scripts/author_e5_seeds.py. Merged over the E4 skeleton at\n"
              "run time by setup_run.sh for the E5 condition.\n")
        n = len(SEMANTIC) + len(spec["episodes"]) + 1
        print(f"{task_id}: wrote {n} memory files")


if __name__ == "__main__":
    main()
