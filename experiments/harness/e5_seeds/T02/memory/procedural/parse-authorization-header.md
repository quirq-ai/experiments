---
name: parse-authorization-header
trigger_when: extracting a token from an incoming Authorization header
---

## Steps
1. Read the header case-insensitively: `auth = request.headers.get("authorization", "")`.
2. If it starts with `"Bearer "`, strip exactly that prefix: `token = auth.removeprefix("Bearer ").strip()`.
3. Otherwise treat the whole value as the raw token (also `.strip()`).
4. Centralize this in one helper and call it everywhere a token is read; add a test for both formats.

## Gotchas
- Header names are case-insensitive — don't index `headers["Authorization"]` assuming exact case.
- Don't split on whitespace blindly; tokens can't contain spaces but be explicit about the `Bearer ` prefix.
- Never log the token value. There is no incoming-auth middleware today, so the fix is wherever a token is consumed.

## Last validated
2026-05-30
