---
date: 2026-05-25
tags: [auth, http, parsing]
outcome: success
---

## What
Wrote a small helper to pull a token out of an Authorization header.

## Why it mattered
Clients send either `Bearer <t>` or a raw `<t>`; inconsistent stripping caused a bug.

## How it went
Header lookups must be case-insensitive (`request.headers.get("authorization")`). I normalized by checking `.startswith("Bearer ")` and using `removeprefix("Bearer ")`, falling back to the raw value, then `.strip()`.
