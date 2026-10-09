# Claude Messages

An iMessage-style window onto every Claude Code session running on this machine.
The sidebar lists the sessions, each thread shows that session's conversation, and you can
message any of them. The compose button starts a new session.

```bash
node server.mjs
```

Then open http://127.0.0.1:4417. You need Node 18 or later and `claude` on your PATH. There
are no dependencies to install.

| Variable | Default | What it sets |
| --- | --- | --- |
| `PORT` | `4417` | The local port |
| `CLAUDE_BIN` | `claude` | The Claude Code executable used for new sessions |
| `CLAUDE_MESSAGES_CWD` | your home folder | The folder the New Session form suggests |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | Where Claude Code keeps sessions and transcripts |

## How it works

| Part | Source |
| --- | --- |
| The session list | `~/.claude/sessions/<pid>.json`, the record each live Claude Code process keeps (name, folder, status, inbox socket) |
| A thread | the session's transcript, `~/.claude/projects/<folder>/<sessionId>.jsonl`, read from its last 1.5 MB and then followed |
| Typing dots | the record's `status` (`busy`), or the turn state of a session started here |
| Sending to a session started here | a user line on its stdin (`claude -p --input-format stream-json ...`) |
| Sending to any other session | one JSON frame on its inbox socket, the same socket other sessions use for `SendMessage` |
| Tool approvals | sessions started here run with `--permission-prompt-tool stdio`, so each approval request shows up as a bubble with Allow and Deny buttons |

The browser talks only to `server.mjs`. The server listens on 127.0.0.1 only. It refuses requests
with any other Host header or a foreign Origin, and every API call needs a token that changes
on each launch. It never reads the session key files.

## Limits

- **You don't type into other sessions directly.** Claude Desktop or the terminal owns their
  input, so a message to a session you didn't start here arrives as a message from *another
  Claude session*. Claude treats it as a teammate's request: it won't count it as your approval
  or change its settings because of it.
- **Bypass-mode sessions hold these messages.** A session in `bypassPermissions` mode holds them
  for approval in its own window. The thread then shows "Sent, not picked up yet".
- **Replies are read from the session's transcript.** The app has no reply address of its own.
- **Sessions started here are tied to the server.** They are child processes of the server and
  stop when it stops. Their transcripts stay on disk.
- **macOS and Linux only.** On Windows the inbox is a named pipe that requires an auth line.
- **This relies on Claude Code internals.** The session records, inbox frames and transcript
  format are undocumented. They were checked against Claude Code 2.1.260 and 2.1.293 and can
  change in any release.
