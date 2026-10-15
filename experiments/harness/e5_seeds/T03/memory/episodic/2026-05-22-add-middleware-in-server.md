---
date: 2026-05-22
tags: [middleware, server]
outcome: success
---

## What
Added a FastAPI middleware in server.py and learned the ordering rules.

## Why it mattered
Middleware added in the wrong place either misses routes or breaks CORS.

## How it went
Middleware is registered with `app.add_middleware(...)` after the app is created and BEFORE routers are included (~lines 555-561, currently only CORSMiddleware). A path-scoped limiter can early-return a `JSONResponse(status_code=429, ...)` for matching paths and pass everything else through.
