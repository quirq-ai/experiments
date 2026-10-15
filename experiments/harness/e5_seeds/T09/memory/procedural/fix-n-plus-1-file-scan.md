---
name: fix-n-plus-1-file-scan
trigger_when: removing an N+1 / repeated-scan pattern over per-item files
---

## Steps
1. Locate the loop that does one fetch/read per item inside a larger loop (here: get_session's linear filename scan).
2. Replace it with a single bulk pass: build an index (session_id -> filepath) during discovery, then O(1) lookups.
3. Where a watermark exists (since_date), push the filter to the source so you skip files/entries before parsing them.
4. Keep the public interface and data semantics identical (sync_payload / list_sessions / get_session shapes).
5. Add a comment explaining what the N+1 was and how it was resolved.

## Gotchas
- This is a FILE-based N+1 (per-file stat+read), not a SQL one — the fix is an index/bulk read, not a JOIN.
- Don't change return shapes — usage endpoints and the sync POST depend on them.
- Watch the dedup-by-message-id logic when batching; don't double-count entries.

## Last validated
2026-05-30
