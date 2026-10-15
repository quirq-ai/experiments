---
date: 2026-05-17
tags: [usage, performance, n+1]
outcome: success
---

## What
Read the usage sync path to find repeated per-file work.

## Why it mattered
The N+1 here is a per-item file scan, not a SQL loop — easy to miss.

## How it went
`services/usage_sync.py` delegates to the active agent's usage module. In `services/cowork_agent/adapters/usage_common.py`, `get_session(session_id)` loops over EVERY discovered session file doing a filename substring match (O(N) file ops to find one). `aggregate_for_sync` parses all files then filters by since_date afterward. The store is file-based JSONL, no DB.
