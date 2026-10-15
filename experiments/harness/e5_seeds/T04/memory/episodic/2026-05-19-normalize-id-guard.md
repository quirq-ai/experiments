---
date: 2026-05-19
tags: [security, scopes]
outcome: success
---

## What
Noticed VisualizerScope normalizes its project_id in __init__.

## Why it mattered
Dropping that during a refactor would reopen a path-traversal hole.

## How it went
`VisualizerScope.__init__` runs `normalize_agent_id(project_id)` before storing/using it (defense against `../etc`). Any dataclass `__post_init__` must keep this normalization and any required-field validation.
