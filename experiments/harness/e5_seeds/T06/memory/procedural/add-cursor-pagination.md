---
name: add-cursor-pagination
trigger_when: adding cursor-based pagination to a list endpoint
---

## Steps
1. Add params: `limit` (default 50, cap 500) and optional opaque `cursor` (base64 of an int offset).
2. Decode cursor -> offset (default 0); slice the sorted result `items[offset:offset+limit]`.
3. Compute `next_cursor` = base64(offset+limit) when more remain, else null; add it alongside existing fields.
4. Stay backward compatible: no cursor/limit -> behave as before (or full list / first page).
5. Test: page 1 returns a next_cursor; page 2 via that cursor returns different items; last page returns null.

## Gotchas
- The endpoint is POST with a JSON body — add the params to the body (or query) consistently; don't silently switch to GET.
- Filesystem ordering can shift between calls; sort stably before slicing so cursors stay meaningful.
- Keep the existing response fields; only ADD `next_cursor`.

## Last validated
2026-05-30
