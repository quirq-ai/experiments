---
date: 2026-05-14
tags: [files, api]
outcome: success
---

## What
Pinned down the file-listing endpoint's real shape.

## Why it mattered
Pagination has to extend the response without breaking existing clients.

## How it went
It's `@router.post("/api/files/list-directory")` (POST, not GET) in `routers/cowork_agent/files.py`, reading a JSON body `{"path": ...}` and returning `{path, parent, dirs, files}` where dirs/files are `{name, path}` lists, sorted in Python by `(not is_dir, name.lower())`. Listing is currently unbounded.
