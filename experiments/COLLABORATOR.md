# Running the experiment — collaborator guide

> **Running this with Claude Code?** Just open this folder in Claude Code — it
> auto-loads **`CLAUDE.md`** (the agent operating contract) and knows exactly what to
> do, end to end. This guide is the human/manual version of the same thing.

Thanks for helping run the **Structured Agent Environments** study. You'll run some
tasks across the 6 environments on your machine; we merge everyone's results.

The research question: does richer project context (nothing → README → AGENTS.md →
full XO scaffold → scaffold + seeded memory) let a coding agent orient faster and
spend fewer tokens, without hurting task success? Each "cell" is one agent run of one
task (T01–T10) in one environment (E0–E5).

---

## 0. What you need

- **Linux/macOS**, `git`, `python3` (3.10+), and network access (one-time, for `pip`).
- **An authenticated agent CLI**:
  - `codex` (OpenAI Codex) — **the agent we're standardizing on** (run.sh default).
    Needs OpenAI credits on your account; check `codex --version`.
  - `claude` (Claude Code) — available via `--agent claude` if asked. It's the only
    agent that records timing metrics, but runs envs serially (see below).
  - Use the **same** agent everyone else is using for a given batch — mixing agents
    in one comparison muddies the signal.
- A few GB of free disk and patience: each cell can take minutes and spends
  **real tokens/credits on your account**. Start small.

You do **not** need to clone xo-cowork-api separately — a self-contained copy is
bundled in the tarball.

---

## 1. Unpack and bootstrap (once)

```bash
tar xzf experiment-*.tgz
cd experiments
bash harness/scripts/bootstrap.sh
```

`bootstrap.sh` builds two things inside `experiments/` and touches nothing else on
your system:
- `target/xo-cowork-api.git` — the bundled bare repo every run is cut from.
- `.venv/` — an isolated Python env (target deps + pytest) used only to grade runs.

The experiment is **hermetic**: it only ever reads/writes inside `experiments/`.
It will not modify any other repo on your machine.

---

## 2. Run your share

Everything goes through `./run.sh`. **Always pass `--tag <yourname>`** — it stamps
your runs so they merge with everyone else's without collisions.

**Work one task at a time.** Each task runs across all 6 environments; with codex,
`--parallel` runs those 6 at once (they're fully isolated worktrees), so a complete
row finishes and you see results in real time before moving to the next task — rather
than waiting for all 60 cells at the end.

```bash
./run.sh --list                                    # see tasks, envs, agents

./run.sh --task T01 --parallel --tag alice         # T01's 6 envs at once → real-time row
./run.sh --task T02 --parallel --tag alice         # then the next task, and so on
./run.sh --task T01 --env E0,E5 --tag alice         # just E0 (bare) vs E5 (full+memory)
./run.sh --task T04 --env E3 --tag alice --dry-run  # preview, run nothing
```

Flags: `--task` (T01..T10 / comma list / `all`), `--env` (E0..E5 / comma list /
`all`, default all), `--agent` (`codex` default | `claude`), `--tag <name>`,
`--parallel` (codex only — run a task's envs concurrently), `--rep <n>` (repeat
number — 2, 3… for more data per cell), `--max-seconds <n>`, `--dry-run`, `--list`.

Notes:
- It's **resume-safe**: a cell that already has a `run_record.json` is skipped, so you
  can stop and re-launch anytime.
- `--parallel` works with codex (default). For claude it's auto-downgraded to serial.
- If we've split the matrix, run the tasks/envs you were assigned.

Watch progress in another terminal:
```bash
python3 monitor.py            # live count + per-env score summary
```

---

## 3. Send results back

Your results live in `runs/`. Each cell directory has the telemetry record, the
transcript, the grader output, and the diff. Bundle and send:

```bash
tar czf results-<yourname>.tgz runs/
```

That's it — the maintainer drops your `runs/` into the combined set and rebuilds the
dataset. Because every run is tagged, nothing of yours overwrites anyone else's.

(If bandwidth matters, `run_record.json` files alone are enough to merge; transcripts
are only needed for a couple of the figures.)

---

## Troubleshooting

- **"hermetic venv missing"** → run `bash harness/scripts/bootstrap.sh`.
- **"out of credits" / auth errors** → that's your agent account, not the harness.
  Top up or switch `--agent`.
- **A run failed** → just re-run the same command; completed cells are skipped and
  only the missing ones retry.
- **Rebuild the venv** → `bash harness/scripts/bootstrap.sh --rebuild-venv`.
