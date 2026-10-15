---
date: 2026-05-16
tags: [tests, workspace-memory]
outcome: success
---

## What
Read `routers/cowork_agent/workspace_memory.py` before writing tests.

## Why it mattered
Tests should match the actual handler shapes and the (currently stubbed) behavior.

## How it went
It defines `router = APIRouter()` (no prefix) with `/api/workspace-memory` GET/PUT/DELETE, `/api/workspace-memory/list` GET, `/refresh` and `/export` POST. Five handlers are sync, `workspace_memory_update(request: Request)` is async. Handlers are stubs returning static values; `workspace_path` is an optional, currently-unused query param.
