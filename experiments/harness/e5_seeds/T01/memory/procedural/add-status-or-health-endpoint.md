---
name: add-status-or-health-endpoint
trigger_when: asked to add an endpoint under routers/status/ (e.g. a health/deep check)
---

## Steps
1. Create a module in `routers/status/` with `router = APIRouter(prefix="/health", tags=["health"])`.
2. Expose the handler, e.g. `@router.get("/deep")` so the full path is `/health/deep`.
3. Discover external services from env vars; check connectivity; return `{"status": ok|degraded|down, "services": {name: status}}`. ok=all up, down=all fail, else degraded.
4. Register it: import the router in `server.py` and add `app.include_router(<router>)` near the other status routers (~line 566).
5. Add a test under tests/ using `TestClient(app)` (create the dir; pytest isn't configured).

## Gotchas
- Routers are NOT auto-discovered — you must add the include_router call in server.py.
- Never put service URLs or credentials in the response — names + status only.
- Status endpoints conventionally delegate to adapters via load_capability; a self-contained probe is fine for /health/deep but keep it agent-agnostic.

## Last validated
2026-05-30
