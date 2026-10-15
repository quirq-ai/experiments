# CLAUDE.md — run this experiment with the Claude agent

**You (Claude Code) have been handed this folder to RUN a research experiment and send the results back.** This file is your operating contract. Read it fully, confirm prerequisites, then start. You are the *orchestrator*: you execute `./run.sh`, which launches a fresh headless `claude` for each measured run. You do **not** do the coding tasks yourself.

---

## 1. What this is

This is `experiments/` — the harness for the **Structured Agent Environments** study. It is a measurement rig, **not an app to develop**. It runs a coding agent against fixed tasks under six levels of project context and records the cost of each run.

- **Environments (context richness):** `E0` empty → `E1` +README → `E2` +AGENTS.md → `E3` +AGENTS+PROJECT → `E4` full XO scaffold → `E5` full scaffold + seeded memory.
- **Tasks:** `T01`–`T10` (fixed coding tasks against a pinned snapshot of the `xo-cowork-api` repo).
- **Research question:** does richer project context let the agent orient faster and spend fewer tokens **without hurting task success**?

A "cell" = one (task, environment, replication). Each cell auto-produces one telemetry record. **Your mission: collect clean cells using the `claude` agent and return the `runs/` folder.**

---

## 2. Hard rules — do not violate

1. **Agent = claude. Always pass `--agent claude`.** The script's default is codex; you must override it every time. Never run codex.
2. **Always `--tag <name>`** — the operator name the human gives you (ask if they didn't). It stamps every run so results merge with other people's without collision. Without it, runs collide.
3. **One task at a time.** Run a task across its 6 envs, let it finish, then the next. Results stream in; don't fire the whole matrix blind.
4. **Do not use `--parallel`.** It is auto-disabled for claude anyway (claude installs a global `~/.claude/settings.json` hook per run that would race, and concurrent load corrupts the timing data). Claude runs serially, one env at a time. That's expected and correct.
5. **No timeout** — already the default. Let every run finish naturally; never add `--max-seconds`.
6. **Hermetic — touch nothing outside `experiments/`.** The harness operates only inside this folder. Do not edit, clone, move, or run anything against any other repository or directory on the machine.
7. **Do not edit** the harness scripts, task files (`harness/tasks/*`), or environment overlays (`harness/envs/*`). They are the experiment's fixed variables. Your job is to *run*, not to change them.

---

## 3. Setup (once)

```bash
cd experiments
bash harness/scripts/bootstrap.sh      # builds the self-contained bare repo + isolated .venv (python3 + network, one time)

claude --version                        # installed?
claude --print "Reply with exactly: OK" # HEADLESS auth check — must print OK
```

**The `--print` check is the important one and must return `OK`.** `--version` does NOT prove auth — the experiment runs claude in headless `--print` mode, which can use *different* credentials than an interactive session. If `--print` returns `Invalid API key`, an auth error, or anything other than OK, **stop and tell the human to fix Claude Code's headless auth** (e.g. log in / set a valid key) before doing anything else. You cannot collect a single valid run until that one line prints OK. Everything else (target repo, Python deps) is built by `bootstrap.sh`; you need nothing from outside this folder.

---

## 4. What data to collect

Run the matrix **with claude**, one task at a time:

```bash
./run.sh --task T01 --agent claude --tag <name>     # T01 across all 6 envs (serial)
./run.sh --task T02 --agent claude --tag <name>     # then T02 …
# … through T10
```

- **Default target:** all 10 tasks × all 6 envs, replication 1. If the human assigned you a subset (specific tasks/envs), do exactly that instead.
- **Replications add power.** After replication 1, do more with `--rep 2`, `--rep 3`, … (same commands). Each cell becomes a distribution instead of a single point — this is the single biggest improvement to the results, so do as many reps as time/limits allow.
- **Resume-safe:** a cell that already has a `run_record.json` is skipped. Stop and relaunch anytime.
- Watch progress live in a second shell: `python3 monitor.py` (or one-shot: `python3 monitor.py --once`).

Useful: `./run.sh --list` shows every task title and environment.

---

## 5. What each cell produces (this is the data)

Every cell writes `runs/<run_id>/`:

| File | What it is |
|------|-----------|
| `run_record.json` | **The canonical telemetry** — tokens (input/output/cache), **timing** (claude populates wall-clock + time-to-first-edit), per-phase token split, navigation (file reads, entropy), operations, and the score. |
| `transcript.jsonl` | Raw Claude Code session (kept for the token-curve / file-heatmap figures). |
| `grade.json` | Acceptance-criteria pass/fail and the automated score. |
| `git.patch` | The diff the agent produced. |

You don't parse these — the harness fills them. Just make sure they exist and look healthy.

---

## 6. Verify before moving on

After a task's cells finish:

```bash
python3 monitor.py --once
```

A **good** cell has `total_input > 0` and a real `terminal_state` (`completed` / `partial` / `failed`). A **bad** cell has `total_input == 0` — that means the agent died before reporting; **delete that run directory and re-run that one cell.** With claude + no timeout this should be rare. Do not return 0-token cells.

---

## 7. Send results back

At any checkpoint or when done:

```bash
tar czf results-<name>.tgz runs/
```

Hand that file to the human. It is everything needed to merge your runs with everyone else's (run IDs are tagged, so nothing overwrites). If bandwidth is tight, the `run_record.json` files alone suffice to merge; include transcripts only if asked.

---

## 8. If something breaks

- **"hermetic venv missing"** → `bash harness/scripts/bootstrap.sh`.
- **claude auth error / `Invalid API key` / quota error** → that's the account/credentials, not the harness. Headless `--print` can use different auth than an interactive session, so make `claude --print "Reply with exactly: OK"` actually print OK first. Pause and tell the human; do **not** switch to codex.
- **a run failed** → just re-run the same `./run.sh` command; completed cells skip, only the missing ones retry.
- **unsure** → read `handoff.md` (full history + known limitations) and `setup-docs/experiment-spec.md` (formal spec + metric definitions). `COLLABORATOR.md` is the human-facing quickstart.

---

## 9. Start now

1. `bash harness/scripts/bootstrap.sh`, then confirm **headless** auth: `claude --print "Reply with exactly: OK"` must print `OK` (not just `--version`).
2. Ask the human for your **operator tag** and any **task/env assignment** (default: all tasks, all envs, rep 1).
3. `./run.sh --task T01 --agent claude --tag <name>` — then proceed task by task, verifying with `monitor.py` as you go.
4. When done, `tar czf results-<name>.tgz runs/` and return it.
