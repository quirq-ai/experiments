---
name: make-create-idempotent
trigger_when: making a create operation idempotent (return existing instead of duplicating/erroring)
---

## Steps
1. Identify the unique key (here: the normalized project id / agent id).
2. On create: check existence first (`project_exists(name)` / `_load(id)`) BEFORE scaffolding.
3. If found: return the existing entity with HTTP 200 and header `X-Created: false`.
4. If new: create as before and return with `X-Created: true` (201 for genuinely new).
5. Preserve all existing behavior for new projects; add a test that creates twice and asserts same entity + codes.

## Gotchas
- created_at is immutable in _upsert_metadata — don't reset it on a repeat call.
- The project folder can exist without an agent record (and vice-versa) — pick the key deliberately.
- There's no unified create endpoint today; you may need to add one (e.g. POST /api/xo-projects) wired to project_layout.

## Last validated
2026-05-30
