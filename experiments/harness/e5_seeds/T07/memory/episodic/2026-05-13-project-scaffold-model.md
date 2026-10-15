---
date: 2026-05-13
tags: [projects, idempotency]
outcome: success
---

## What
Mapped how projects get created and what identifies them.

## Why it mattered
Idempotent creation needs the real unique key and the existing create path.

## How it went
`scaffold_project(name, *, display_name, description)` in `services/cowork_agent/project_layout.py` copies a template (file-copy is already idempotent) and `_upsert_metadata` writes `.xo/project.json` ({name, display_name, description, created_at}) — created_at is set once and never overwritten. The unique key is the normalized project id (folder name under ~/xo-projects/). There is no unified POST create endpoint yet.
