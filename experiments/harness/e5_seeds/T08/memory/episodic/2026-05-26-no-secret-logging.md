---
date: 2026-05-26
tags: [security, logging]
outcome: success
---

## What
Reconfirmed the don't-log-secrets rule while planning log replacement.

## Why it mattered
Structured logs make it easy to accidentally bind a token into context.

## How it went
CLAUDE.md says avoid logging sensitive values. claude_setup_token.py prints PTY/session state and codex_setup handles tokens — when converting these, log presence/source/returncode, never the token. Bind a request_id, not auth.
