---
name: write-fastapi-route-tests
trigger_when: writing a pytest suite for a router module
---

## Steps
1. Read the module: list every route, method, path, and which handlers are async vs sync.
2. Create `tests/test_<module>.py`; build a client with `TestClient(app)` (import app from server.py).
3. Cover happy path + error/edge for each handler; for stubbed handlers assert the static response shape.
4. Mock filesystem/DB/external calls with monkeypatch or tmp_path; keep at least 3 distinct test functions.
5. Ensure pytest is available (not in requirements.txt); run `pytest tests/ -q`.

## Gotchas
- No tests/ dir or pytest config exists at this commit — create them.
- `workspace_memory_update` is async but TestClient handles it fine; no need for AsyncClient unless you prefer it.
- Handlers are stubs today; don't assert real persistence behavior that isn't implemented yet.

## Last validated
2026-05-30
