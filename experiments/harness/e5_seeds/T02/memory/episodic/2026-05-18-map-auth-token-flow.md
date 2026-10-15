---
date: 2026-05-18
tags: [auth, tokens]
outcome: success
---

## What
Traced how `routers/auth/auth.py` obtains the token used for outbound calls.

## Why it mattered
Touching auth safely requires knowing which token is which — there are three unrelated ones.

## How it went
`get_auth_token()` returns `XO_API_KEY` if set, else the in-memory consume-flow `access_token`. `ChatAPIClient._headers()` builds `{"Authorization": f"Bearer {token}"}` for xo-swarm-api. Separately, claude_setup_token.py captures the Claude CLI OAuth token and codex_setup.py the Codex token — never cross them.
