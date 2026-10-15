---
date: 2026-05-28
tags: [routing, server, gotcha]
outcome: partial
---

## What
Added a new status router but the endpoint 404'd until I registered it.

## Why it mattered
Router registration is manual here — a recurring trap.

## How it went
Routers are mounted explicitly in `server.py` around lines 566-568 via `app.include_router(...)`. Importing the module is not enough; I had to add the include_router call. After that the route resolved.
