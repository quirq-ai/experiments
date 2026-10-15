---
date: 2026-05-20
tags: [status, routing, fastapi]
outcome: success
---

## What
Mapped how `routers/status/` is organized while adding a status endpoint.

## Why it mattered
The next status/health work needs the exact registration path; getting it wrong means the route 404s.

## How it went
Each status concern is its own module (providers.py, models.py, channels.py) with `router = APIRouter(prefix="/X", tags=["X"])` exposing `@router.get("/status")` -> path `/X/status`. Handlers resolve `agent = resolve_agent_name()` then `load_capability("<x>_status", agent=agent)` and map a `CliStatusError.code` to an HTTP status. External checks live in the agent adapter, NOT the router.
