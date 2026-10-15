# Constraints — house rules (AGENTS.md / CLAUDE.md / DEVELOPING.md)

- MODULARITY INVARIANT: no core file may hard-code a specific agent name
  (`openclaw` / `hermes` / `claude_code`). Anything agent-specific resolves through
  `services/cowork_agent/adapters/loader.py`. (DEVELOPING.md §6; small documented
  exception allowlist exists.)
- Preserve request/response contracts unless the task explicitly says to change
  them. Backward compatibility is sacred. (DEVELOPING.md §7)
- NEVER log or print secrets, tokens, API keys, or credentials.
  (CLAUDE.md: "Avoid logging sensitive values".)
- The project folder is sacred: never write chat content, credentials, or anything
  that wouldn't survive a `git push` into `~/xo-projects/<id>/`. (DEVELOPING.md §7)
- Keep route handlers thin — business logic belongs in `services/`.
- Keep edits minimal and targeted: one concern at a time.
- Use async patterns for network/subprocess work (httpx.AsyncClient, asyncio.subprocess).
- Validation playbook (DEVELOPING.md §5): import gate + route parity (claude_code /
  openclaw / hermes ≈ 146 / 149 / 173 routes) + modularity check.
