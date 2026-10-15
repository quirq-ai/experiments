# xo-cowork-api

FastAPI backend that brokers chat and auth flows for AI coding agents
(Claude Code, OpenClaw, Hermes, Codex). Acts as a control plane over
multiple agent runtimes via a uniform `/api/*` surface.

## Architecture

- **Routers** (`routers/`): thin FastAPI route handlers, one subdirectory per domain
  - `cowork_agent/` — agent chat, sessions, files, usage, onboarding, config
  - `auth/` — token auth, per-agent setup flows
  - `status/` — provider and channel health
- **Services** (`services/cowork_agent/`): business logic, adapters, state
- **Adapters** (`services/cowork_agent/adapters/<name>/`): per-agent capability modules
  (auto-discovered, zero core edits to add a new agent)
- **Config** (`config/agents/<name>/`): per-agent lifecycle config

## Stack

Python 3.11, FastAPI, uvicorn, SQLite (via aiosqlite), httpx, pydantic v2.

## How to run

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
AGENT_NAME=claude_code uvicorn server:app --reload --port 5002
```

## How to test

```bash
pytest tests/ -q
```

## Key files

| File | Purpose |
|------|---------|
| `server.py` | App factory, router registration |
| `services/cowork_agent/adapters/loader.py` | Capability loader |
| `registry/adapter_registry.py` | Agent auto-discovery |
| `DEVELOPING.md` | Full engineering guide |
