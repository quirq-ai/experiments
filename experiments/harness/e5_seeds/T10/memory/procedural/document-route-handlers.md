---
name: document-route-handlers
trigger_when: adding OpenAPI summaries/descriptions to undocumented route handlers
---

## Steps
1. Enumerate handlers in routers/cowork_agent/, routers/auth/, routers/status/ and flag those with no docstring and no summary=/description=.
2. For each, add a docstring: first line = concise summary; following 2-4 sentences = description of params/behavior. (Equivalently use summary=/description= on the decorator — but match the docstring convention used here.)
3. Change DOCS ONLY — no logic edits.
4. Verify the app still imports cleanly (import gate) and the OpenAPI schema now includes the descriptions.

## Gotchas
- FastAPI reads the docstring: first line -> summary, remainder -> description. Keep that shape.
- Don't touch handler logic — this is documentation only.
- auth/* and status/* are mostly already documented; focus on chat.py and sessions.py.

## Last validated
2026-05-30
