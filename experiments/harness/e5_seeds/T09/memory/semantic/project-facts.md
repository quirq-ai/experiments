# Project facts — xo-cowork-api

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
