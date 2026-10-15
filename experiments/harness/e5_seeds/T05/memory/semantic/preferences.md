# Preferences — observed coding style

- New endpoint? Follow the existing router in its domain: create/extend a module
  under `routers/<domain>/`, define `router = APIRouter(prefix=..., tags=[...])`,
  then register it (server.py include_router, or add to `all_routers` for
  cowork_agent). Mirror a neighbouring handler's shape.
- Status endpoints delegate external-service checks to agent adapters via
  `load_capability("<x>_status")` rather than probing services directly.
- Tests: there is NO `tests/` dir at this commit and no pytest config. The fitting
  idiom is `from fastapi.testclient import TestClient; client = TestClient(app)`
  (sync); use `httpx.AsyncClient` for async handlers. You must add pytest yourself.
- OpenAPI docs come from function docstrings (FastAPI uses the first line as the
  summary, the rest as the description) — not `summary=`/`description=` kwargs.
- Prefer editing in place over rewrites; match surrounding style. Existing
  diagnostics are emoji-prefixed `print()` in server.py and
  `logging.getLogger(__name__)` in connector modules.
