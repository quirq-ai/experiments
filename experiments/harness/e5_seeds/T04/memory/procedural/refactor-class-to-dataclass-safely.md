---
name: refactor-class-to-dataclass-safely
trigger_when: converting plain classes/dicts to dataclasses without breaking callers
---

## Steps
1. Inventory the public surface first: exported classes, `resolve_scope`'s signature, field names, return shapes.
2. Grep for every importer/caller (here: `routers/cowork_agent/bff/*`) and note how they construct/access scopes.
3. Introduce `@dataclass` with typed fields matching the current data; move existing `__init__` logic (e.g. id normalization) into `__post_init__`; add validation for required-non-empty fields.
4. Keep method names, the `resolve_scope(name, *args)` dispatch, and return types identical.
5. Run/import-check; if no tests exist, exercise the BFF routes that call resolve_scope.

## Gotchas
- Preserve `normalize_agent_id()` on project_id — it's a path-traversal guard, not incidental.
- `_XoReader` uses CLASS-level constants read as `self._xo_root / self._STATS`; keep class-var precedence.
- Do not change `resolve_scope`'s variadic `*args` contract — call sites pass 0 or 1 extra arg.

## Last validated
2026-05-30
