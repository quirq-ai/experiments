# PROJECT.md

> What this folder is, who it's for, and what is in scope. Edit when scope changes — not on every session.
>
> **`[TEMPLATE]` markers below mean this folder is fresh.** On first boot, the agent must replace each marker with real content (or ask the user) before doing project work.

## Name

`xo-cowork-api`

## One-line description

`FastAPI control plane for multi-agent AI coding sessions.`

## Why this exists

`Brokers chat, auth, and file operations across Claude Code, OpenClaw, Hermes, and Codex via a uniform REST API. Allows a single frontend to drive any agent runtime without knowing which one is active.`

## In scope

- REST API for agent chat, sessions, files, usage, and auth
- Per-agent adapter modules under services/cowork_agent/adapters/
- xo-project sync and backup flows

## Out of scope

- Frontend/UI code
- Agent runtime internals (Claude Code, Codex binaries)
- Infrastructure provisioning

## Stack & conventions

`Python 3.11, FastAPI, uvicorn, pydantic v2, aiosqlite, httpx. Tests: pytest. Lint: ruff.`

## Stakeholders

- **Owner:** `tools@kosh.network`
- **Other peers:** see `.xo/peers.json`

## How to run / build / test

```
AGENT_NAME=claude_code uvicorn server:app --reload --port 5002
pytest tests/ -q
```

---

*This file is part of the stable prefix. Keep it under ~80 lines. Read by every agent at boot.*
