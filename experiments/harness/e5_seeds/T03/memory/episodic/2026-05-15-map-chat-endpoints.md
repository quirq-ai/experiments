---
date: 2026-05-15
tags: [chat, routing]
outcome: success
---

## What
Located the chat endpoints and their lifecycle.

## Why it mattered
Rate limiting must cover the right paths without breaking the streaming flow.

## How it went
Chat routes are `@router.post("/api/chat/prompt")`, `/api/chat/abort`, `/api/chat/respond` on a bare `APIRouter()` in `routers/cowork_agent/chat.py`. POST /api/chat/prompt returns a stream_id; the client then polls GET /api/chat/stream/{id} (SSE). State lives in a process-local dict (single-worker only).
