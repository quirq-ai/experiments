---
date: 2026-05-10
tags: [openapi, docs, fastapi]
outcome: success
---

## What
Confirmed how this repo expresses OpenAPI docs.

## Why it mattered
Matching the house convention keeps the generated schema consistent.

## How it went
No route uses `summary=`/`description=` kwargs — FastAPI derives them from the handler DOCSTRING (first line = summary, rest = description). auth/* and status/* handlers are fully documented; chat.py and sessions.py are only ~30-40% documented (most POST/GET/PATCH/DELETE there have no docstring) — that's the gap to fill.
