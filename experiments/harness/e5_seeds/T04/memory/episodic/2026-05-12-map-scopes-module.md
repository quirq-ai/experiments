---
date: 2026-05-12
tags: [scopes, refactor, bff]
outcome: success
---

## What
Read `services/cowork_agent/scopes.py` end to end before touching it.

## Why it mattered
A dataclass refactor must keep `resolve_scope` and every call site working.

## How it went
The module exposes `resolve_scope(name, *args) -> ScopeHandle` (a Union of `Path | SecretsScope | VisualizerScope | WorkspaceVisualizerScope`). `_XoReader` is a base with class-level filename constants (`_STATS`, `_TODOS`, ...). Call sites in `routers/cowork_agent/bff/` always go through `resolve_scope(...)`.
