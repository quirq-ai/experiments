---
name: introduce-structured-logging
trigger_when: replacing print/stdlib logging with structlog
---

## Steps
1. Add `structlog` to requirements.txt.
2. Configure structlog once at startup (a `config/logging.py` helper or top of server.py): JSON renderer when `LOG_FORMAT=json`, console renderer otherwise.
3. Replace `print(...)` in routers/ and services/ with `log = structlog.get_logger(); log.info/warning/error(...)`, choosing levels deliberately; migrate existing `logging.getLogger` call sites too.
4. Add a middleware that binds a `request_id` into the log context per request.
5. Verify the app still imports and starts; spot-check that no token/credential is logged.

## Gotchas
- Don't place the logging config under config/agents/<name>/ or config/models/<name>/ — those are per-agent boundaries.
- Preserve useful startup diagnostics (consider debug level) — server.py relies on them for observability.
- Never bind tokens/credentials into structlog context; request_id and source/returncode are fine.

## Last validated
2026-05-30
