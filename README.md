# Workbench

A Codex-style desktop app with two interchangeable engines behind one UI:

| Engine | Process | Backed by |
| ------ | ------- | --------- |
| Codex  | `codex app-server` | the Codex CLI on your PATH (ChatGPT or API login) |
| Claude | `claude-app-server` (this repo) | Claude Code via `@anthropic-ai/claude-agent-sdk` |

Both processes speak the same protocol: the Codex app-server JSON-RPC (v2), newline-delimited over stdio. `claude-app-server` implements the subset Workbench uses, so the Electron app has one client, one transcript reducer and one set of components. Each thread is pinned to the engine it started on.

## Run

```bash
nvm use            # Node 24
npm install
npm run dev        # Electron + Vite with HMR
npm run build && npm start
```

Env vars:

- `WORKBENCH_CODEX_BIN`: path to `codex` if it is not on PATH.
- `WORKBENCH_USER_DATA`: alternate data directory (testing).
- `WORKBENCH_DEBUG=1`: log every JSON-RPC line to stderr.

`claude-app-server` also runs standalone: `node out/main/claude-app-server.js`, then write JSON-RPC lines to stdin.

## Layout

```
src/
  shared/protocol.ts       app-server protocol subset (from `codex app-server generate-ts`)
  shared/rpc.ts            newline JSON-RPC peer, used by both ends of the pipe
  shared/transcript.ts     notifications -> transcript reducer (main persists, renderer draws)
  shared/types.ts          app types, access presets (Read only / Ask / Agent / Full access)
  claude-app-server/       Claude Agent SDK behind the app-server protocol
  main/engines.ts          spawns and initializes each app-server, routes approvals
  main/index.ts            window + IPC
  main/store.ts            projects, thread index, transcripts (JSON in userData)
  main/git.ts              working-tree diff for the Diff panel
  renderer/                React UI
```

## Protocol mapping (Claude side)

| app-server | Claude Agent SDK |
| ---------- | ---------------- |
| `thread/start` | new UUID, used as `sessionId` on the first `query()` |
| `thread/resume` | `resume: threadId` on later turns |
| `turn/start` | one `query()` per turn, `includePartialMessages` for deltas |
| `turn/interrupt` | `AbortController.abort()` |
| `item/agentMessage/delta` | `text_delta` stream events |
| `commandExecution` item | `Bash` tool_use + tool_result |
| `fileChange` item | `Edit` / `MultiEdit` / `Write` |
| `mcpToolCall` / `dynamicToolCall` | `mcp__*` / every other tool |
| `item/*/requestApproval` | `canUseTool` callback |
| approval + sandbox | permission mode: read-only = `plan`, untrusted = `default`, on-request = `acceptEdits`, never + full = `bypassPermissions` |
