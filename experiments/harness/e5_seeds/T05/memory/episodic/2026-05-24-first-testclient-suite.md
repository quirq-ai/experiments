---
date: 2026-05-24
tags: [tests, pytest, scaffolding]
outcome: partial
---

## What
Stood up the first pytest suite in a repo that had none.

## Why it mattered
There's no tests/ dir or pytest config, so the harness has to be created from scratch.

## How it went
Created tests/ and used `from fastapi.testclient import TestClient; client = TestClient(app)` importing the app from server.py. Sync handlers work directly with TestClient; the one async handler also works through it. Had to `pip install pytest` — it isn't in requirements.txt.
