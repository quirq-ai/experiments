---
date: 2026-05-27
tags: [usage, performance]
outcome: partial
---

## What
Spotted that the date watermark is applied too late.

## Why it mattered
Filtering after parsing every file wastes the watermark's benefit.

## How it went
`aggregate_for_sync` calls `parse_file(sf)` for all files, THEN drops entries older than since_date. Pushing the date filter into discovery/parse (skip files/entries before the watermark) cuts the work. The fix for get_session is to build a session_id -> path index once instead of rescanning.
