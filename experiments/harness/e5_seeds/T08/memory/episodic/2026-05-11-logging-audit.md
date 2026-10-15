---
date: 2026-05-11
tags: [logging, structlog, audit]
outcome: success
---

## What
Audited current logging before introducing structlog.

## Why it mattered
Knowing where prints concentrate scopes the migration and avoids missing config.

## How it went
~122 `print()` calls (≈65 in server.py, ≈31 in routers/auth/claude_setup_token.py, rest scattered) plus ~26 stdlib `logging.getLogger(__name__)` usages in connectors/visualizer. No central logging config anywhere. `structlog` is NOT in requirements.txt. Server startup is print-heavy (emoji-prefixed diagnostics in lifespan).
