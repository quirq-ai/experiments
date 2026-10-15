---
name: add-fastapi-middleware-or-dependency
trigger_when: adding cross-cutting behavior (rate limiting, auth) to a set of routes
---

## Steps
1. Decide scope: middleware (covers all requests, filter by `request.url.path`) vs a router dependency (per-route).
2. For /api/chat/* rate limiting, an ASGI/HTTP middleware keyed on `request.client.host` with an in-memory sliding window (deque of timestamps per IP) is simplest; no Redis needed.
3. Read the limit from env (`RATE_LIMIT_RPM`, default 10). On exceed, return `JSONResponse(429, {"error": "rate_limit_exceeded", "retry_after": <s>})`.
4. Register with `app.add_middleware(...)` in server.py after app creation; ensure non-chat paths are untouched.
5. Test: 10 pass, 11th in a minute -> 429, resets after the window.

## Gotchas
- In-memory state assumes a single uvicorn worker (the repo already relies on this for chat state).
- Only affect /api/chat/* — guard on the path prefix so other routes are unaffected.
- Don't rate-limit the SSE stream polling so aggressively that a normal conversation breaks.

## Last validated
2026-05-30
