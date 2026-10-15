# Experiment Handoff — Structured Agent Environments Pilot

**Working directory:** `/home/coder/experiments/l1/experiments`  
**Date:** 2026-06-11 (updated 2026-06-12)  
**Pilot status:** 3 real completions (T01 × E0–E2, Codex). Harness now multi-operator
and hermetic; ready to fan out across collaborators.

> **Handing this to a Claude agent to run?** It auto-reads **`CLAUDE.md`** (the agent
> operating contract — claude-only, no timeout, tagged, hermetic) the moment Claude Code
> opens this folder. Humans: start with **`COLLABORATOR.md`**.

---

## UPDATE 2026-06-12 — multi-operator + containment

This pass made the experiment safe to hand to multiple people who each run a slice
and send results back to merge. **For running it, see `COLLABORATOR.md`.** Key changes
(these supersede the matching stale parts further down, which are kept for history):

**1. Containment — the experiment is now hermetic.**
A prior run had leaked a full T01 implementation into a *shared, unrelated* checkout
at `/home/coder/xo-cowork-api` (the `sharmasuraj0123` fork), because `setup_run.sh`
symlinked — and could `cowork-api.sh install` into — `../xo-cowork-api`.
- `setup_run.sh` now uses an experiment-local **`.venv`** (built by the new
  `harness/scripts/bootstrap.sh`) and never reads from or writes to any external repo
  at run time. The `cowork-api.sh install` fallback is gone.
- The bare repo `target/xo-cowork-api.git` is self-contained (no `objects/info/alternates`).
- The contaminated `/home/coder/xo-cowork-api` was deleted and replaced with a clean
  copy of the experiment-ready `dwivedi-ai/xo-cowork-api` (pinned SHA, fresh venv).
- Net: every run touches only `experiments/`. Confirmed — a setup+grade smoke test
  left both external repos with 0 dirty files.

**2. Multi-operator runs that merge cleanly.**
- New friendly entry point **`./run.sh`** with real flags:
  `--task T01 --env E0,E5 --agent claude|codex --tag <name> [--rep N] [--dry-run] [--list]`.
  A task with no `--env` runs all 6 environments. `--list` shows tasks/envs/agents.
- New **`--tag <operator>`** stamps each run. `run_id` becomes
  `pilot-T01-E0-claude-sonnet-4-6-<tag>-001`, and `operator` is written to
  `run_meta.json` → `run_record.json` → the analysis dataset (schema + extractor +
  `build_dataset.py` updated). Different people's runs no longer collide; replications
  across operators are exactly the extra `n` the full study needs.
- `harness/scripts/make_tarball.sh` → a self-contained ~1 MB tarball for collaborators.
- `harness/scripts/merge_results.sh [--rebuild] results-*.tgz` → ingest their bundles
  into `runs/` (collision-safe) and optionally rebuild the dataset.
- `monitor.py` replaces `monitor_pilot.py`'s hardcoded 60-target with a subset-aware,
  operator-aware live view.
- Agent is now a flag — **both** `claude` and `codex` are first-class. Standardize on
  one agent per comparison; `claude` is the default (works now, gives timing metrics).

**3. Task bugs fixed.**
- **YAML parse bug was worse than documented:** `T03, T04, T06, T07` (not just T04/T06)
  all failed `yaml.safe_load` on an unescaped `\|` in grep ACs. All four are fixed
  (`\\|`); all 10 tasks now parse.
- **T02 was a non-task** — both automated ACs passed on the untouched repo (false
  score=1.0). Rewritten with base-negative ACs (must actually strip a `Bearer ` prefix
  *and* add a test). A do-nothing run now scores 0.33; a real fix scores 1.0.
- **T05 pytest** now available via the hermetic `.venv` (the symlinked venv previously
  lacked pytest).
- The 9 DEAD/JUNK Codex runs were deleted (they were 4-line credit-error transcripts
  that would have polluted analysis and blocked re-runs). The 3 real runs are kept.

**4. E5 seed memory was empty — now populated.**
Every `harness/e5_seeds/<task>/memory/*.md` shipped as a 0-byte placeholder, and
the setup merge copied those empties *over* E4's template semantic memory — so E5
had *less* memory than E4 and the central "does seeded memory help?" comparison was
meaningless. `harness/scripts/author_e5_seeds.py` now writes curated,
codebase-grounded seeds for all 10 tasks: a shared **semantic** foundation (repo
architecture, house rules, style) + 2 task-specific **episodic** memories (prior
sessions worked near the task) + 1 task-specific **procedural** how-to. Verified to
merge into the E5 workspace over the E4 skeleton. (Semantic is intentionally shared
across tasks — it's durable repo knowledge; the task-relevant head start is the
episodic/procedural pair.)

**5. Codex telemetry — verified against real transcripts (we are using codex).**
- Tokens: **yes** — `turn.completed.usage` gives input/output tokens.
- Cache: **yes** (the earlier "0 cache in codex" note was wrong) — on T01 ~96% of
  input was cached; the cache-discounted `total_effective` is the meaningful cost
  metric and still shows the context→fewer-tokens trend (E0 317k > E1 278k > E2 216k).
- Timing: **no** — codex `--json` events carry no timestamps, so
  `wall_clock_seconds` and `time_to_first_edit_seconds` are null for codex (3 of the
  12 figures are claude-only). Getting timing would mean dropping `--ephemeral` and
  parsing the rollout session file — not done.
- Codex is the chosen agent and the `run.sh` default. `claude` stays available via
  `--agent claude` (it's the only agent that populates timing).

---

## How to run it — operator guide (task-by-task, real-time)

These are instructions for the **person/orchestrator** running the experiment. They
are intentionally **not** part of any task prompt — the agent inside each run only
ever sees its task's prompt, never this orchestration guidance.

- Run **one task at a time** (T01, then T02, …) so a complete env-row lands before
  the next task starts and results stream in real time. Don't fire all 60 cells blind.
- A task's 6 environments are fully isolated (separate git worktrees / codebases), so
  they can run **in parallel** safely. With codex, use `--parallel`:
  ```bash
  ./run.sh --task T01 --parallel --tag <you>     # T01's E0..E5 at once → one row
  ./run.sh --task T02 --parallel --tag <you>     # then the next task
  python3 monitor.py                              # live per-env results (other terminal)
  ```
- `--parallel` is honored for **codex only**. For claude it auto-downgrades to serial:
  claude installs a global `~/.claude/settings.json` hook per run (parallel runs would
  race and corrupt it) and concurrent CPU load would distort its wall-clock/TTFUA
  timing. Codex has no global hook and no timing to distort, so parallel envs give the
  same token/cache/navigation data as serial.
- To compare two conditions directly, narrow envs: `./run.sh --task T01 --env E0,E5 --tag <you>`.
- Everything is resume-safe and operator-tagged, so stop/restart freely and merge later
  with `harness/scripts/merge_results.sh`.

---

## Run progress & gaps (2026-06-12, codex)

Real codex data collected so far (16 clean runs):

| Task | Envs done | Notes |
|------|-----------|-------|
| T01  | E0 (×2), E1, E2, E3, E4, E5 | **complete row**; all score 1.0 |
| T02  | E0, E1, E2, E3 | all **partial 0.667** (agent does 2/3 ACs — typically fixes the strip but skips the test, or vice-versa) |
| T03  | E0, E1, E2, E3, E5 | E2/E3/E5 score 1.0; E0/E1 partial 0.667 |

**Missing cells that must be re-run when codex limits refresh:**
- **T02 · E4**, **T02 · E5**, **T03 · E4** — deleted, no valid data.

Why they're missing: T02 and T03 were launched together while T01 was finishing, i.e.
**~18 concurrent codex sessions** (3 tasks × 6 envs). Under that load the API slowed
enough that the richest-context cells (E4/E5) blew the 900 s timeout and recorded
**0 tokens** (no `turn.completed` event before the kill). A re-run attempt then hit
**exhausted codex limits** and produced 0-token junk, so those were deleted too.

Re-run them (one task at a time, low concurrency) once limits return:
```bash
./run.sh --task T02 --env E4,E5 --tag <you> --max-seconds 1500
./run.sh --task T03 --env E4     --tag <you> --max-seconds 1500
```

**Lesson (worth keeping):** `--parallel` is great at **6-wide (one task's envs)**, but
running several tasks at once (12–18 concurrent codex sessions) caused timeouts and
burned through the rate limit. Prefer **one task at a time** with `--parallel`; don't
stack multiple parallel tasks on a single codex account.

---

## Research question

Does providing richer project context (README → AGENTS.md → full XO scaffold → seeded episodic memory) reduce the token cost and exploration overhead of an LLM coding agent on standard software tasks — without degrading task success?

The hypothesis is that structured context files let the agent orient faster (fewer shell probes, fewer file reads) so it reaches the first edit sooner and uses fewer total input tokens.

---

## Experiment design

**10 tasks × 6 environments × 1 agent = 60 cells**, 1 replication each.

### Tasks (harness/tasks/T01.yaml … T10.yaml)

| ID | Title | Difficulty |
|----|-------|-----------|
| T01 | Add GET /health/deep endpoint | easy |
| T02 | Fix bearer token not stripped from Authorization header | easy |
| T03 | Add per-IP rate limiting to /api/chat endpoints | medium |
| T04 | (see yaml) | medium |
| T05 | (see yaml) | medium |
| T06 | (see yaml) | medium |
| T07 | (see yaml) | hard |
| T08 | Replace print/logging with structlog structured logging | hard |
| T09 | (see yaml) | hard |
| T10 | Document the full API surface in OpenAPI operation descriptions | easy |

Note: T04 and T06 yaml files have a YAML parsing bug (unescaped `\|` in a double-quoted AC command string) — safe_load chokes. Use a text read or fix the escape before parsing.

### Environments (harness/envs/E0 … E5)

| ID | Label | Overlay files added to bare repo |
|----|-------|----------------------------------|
| E0 | Empty workspace | nothing |
| E1 | README only | README.md (43 lines) |
| E2 | AGENTS.md only | AGENTS.md (239 lines) |
| E3 | AGENTS.md + PROJECT.md | AGENTS.md + PROJECT.md (49 lines) |
| E4 | Full XO (empty memory) | AGENTS.md + CLAUDE.md + PROJECT.md + OBJECTIVES.md + PLAN.md + PROGRESS.md + memory/ skeleton |
| E5 | Full XO + seeded memory | Same as E4 + task-specific episodic memory from harness/e5_seeds/{task_id}/ |

All environments start from the same pinned git SHA (`4e09644cab6f2ac4a2b91573fb670a0546f69cd4`) of the `xo-cowork-api` repo. Base-repo doc files (README.md, AGENTS.md, CLAUDE.md, DEVELOPING.md, .agents/, .claude/) are **stripped** before the overlay is applied so environments are clean.

### Agent

Currently configured: `codex` (OpenAI Codex CLI).  
The harness also has a `claude-sonnet-4-6` agent entry in `harness/config.yaml` — switching agents requires only changing `AGENT_ID=` in the run command.

---

## Current pilot state

### Run inventory (as of 2026-06-11)

```
runs/
  pilot-T01-E0-codex-001/   ✓ REAL  score=1.0  tok=2,203,107  reads=13  edits=5
  pilot-T01-E1-codex-001/   ✓ REAL  score=1.0  tok=1,403,820  reads=13  edits=6
  pilot-T01-E2-codex-001/   ✓ REAL  score=1.0  tok=1,272,483  reads=17  edits=4
  pilot-T01-E3-codex-001/   ✗ DEAD  score=0.67 tok=0  (credits error, 4-line transcript)
  pilot-T01-E4-codex-001/   ✗ DEAD  score=0.67 tok=0  (credits error, 4-line transcript)
  pilot-T01-E5-codex-001/   ✗ DEAD  score=0.67 tok=0  (credits error, 4-line transcript)
  pilot-T02-E0-codex-001/   ✗ JUNK  score=1.0  tok=0  (credits error BUT T02 AC passes on base repo)
  pilot-T02-E1-codex-001/   ✗ JUNK  score=1.0  tok=0  (same)
  pilot-T02-E2-codex-001/   ✗ JUNK  score=1.0  tok=0  (same)
  pilot-T02-E3-codex-001/   ✗ JUNK  score=1.0  tok=0  (same)
  pilot-T02-E4-codex-001/   ✗ JUNK  score=1.0  tok=0  (same)
  pilot-T02-E5-codex-001/   ✗ JUNK  score=1.0  tok=0  (same)
```

**T03–T10 were never started** — the pilot process died after T02.

The credit error transcript looks like this (4 lines, no agent work):
```json
{"type":"thread.started","thread_id":"..."}
{"type":"turn.started"}
{"type":"error","message":"Your workspace is out of credits. Add credits to continue."}
{"type":"turn.failed","error":{"message":"Your workspace is out of credits. Add credits to continue."}}
```

T02's AC1 (`grep -r 'Bearer' routers/ | wc -l >= 1`) passes on the untouched base repo because "Bearer" already appears in the existing auth code. So T02/E0–E5 all falsely show score=1.0 despite zero agent work.

### Preliminary finding from 3 real runs

Token cost drops sharply as context richness increases, with no change in success rate:

| Env | Input tokens | Shell commands | File reads | Score |
|-----|-------------|---------------|-----------|-------|
| E0 (bare) | 2,203,107 | 68 | 13 | 1.0 |
| E1 (+README) | 1,403,820 | 44 | 13 | 1.0 |
| E2 (+AGENTS.md) | 1,272,483 | 42 | 17 | 1.0 |

A 43-line README cuts token use by 36%. Adding AGENTS.md gets another 6%. The savings come from fewer shell explorations, not fewer file reads.

Figure saved at: `results/processed/figures/preliminary_T01_E0-E2.png`

---

## Immediate blocker: OpenAI credits exhausted

Every Codex run fails with `"Your workspace is out of credits."` immediately on `turn.started`.

**To resume with Codex:** add credits to the OpenAI account, then:

```bash
# 1. Delete the 9 bad runs (DEAD + JUNK)
rm -rf runs/pilot-T01-E3-codex-001 runs/pilot-T01-E4-codex-001 runs/pilot-T01-E5-codex-001
rm -rf runs/pilot-T02-E0-codex-001 runs/pilot-T02-E1-codex-001 runs/pilot-T02-E2-codex-001
rm -rf runs/pilot-T02-E3-codex-001 runs/pilot-T02-E4-codex-001 runs/pilot-T02-E5-codex-001

# 2. Resume pilot (skips the 3 real runs automatically)
cd /home/coder/experiments/l1/experiments
AGENT_ID=codex bash harness/scripts/run_experiment.sh
```

**Alternative — switch to Claude Code as agent:**  
The harness already has a `claude-sonnet-4-6` entry in config.yaml. Switching means:
- Results won't be directly comparable to the 3 existing Codex runs (different agent, different tool semantics)
- But the extractor already has a Claude Code adapter (`harness/extract/adapters/claude_code.py`) — it's the more battle-tested path
- Run with: `AGENT_ID=claude-sonnet-4-6 bash harness/scripts/run_experiment.sh`
- Note: Claude Code transcripts land in `~/.claude/projects/*/**.jsonl`, not stdout — the teardown script handles collection via `transcript_glob` in config.yaml

---

## How the pipeline works

### End-to-end flow

```
run_experiment.sh
  └─ for each task × env:
       setup_run.sh          → creates git worktree, applies overlay, writes run_meta.json
       codex exec ... < /dev/null > transcript.jsonl  (or: claude --print ...)
       teardown_run.sh       → calls extract_telemetry.py → run_record.json
                               calls validate_schema.py
                               removes worktree
```

### Key scripts

| Script | Purpose |
|--------|---------|
| `harness/scripts/run_experiment.sh` | Outer loop; resume-safe (skips existing run_record.json) |
| `harness/scripts/setup_run.sh` | Worktree creation + overlay application + doc stripping |
| `harness/scripts/teardown_run.sh` | Telemetry extraction, schema validation, worktree removal |
| `harness/scripts/gen_environments.sh` | One-time: generates E0–E5 overlay directories |
| `harness/extract/extract_telemetry.py` | Parses transcript → run_record.json |
| `harness/extract/adapters/codex.py` | Codex-specific event parser |
| `harness/extract/adapters/claude_code.py` | Claude Code-specific event parser |
| `harness/extract/grade_run.py` | Executes acceptance criteria shell commands in workspace |
| `analysis/scripts/build_dataset.py` | Flattens all run_record.json → results/processed/dataset.parquet |
| `analysis/scripts/compute_metrics.py` | Derived metrics → results/processed/metrics.parquet |
| `analysis/scripts/run_stats.py` | Statistical tests → results/processed/stats_results.json |
| `analysis/scripts/gen_figures.py` | All 12 paper figures → results/processed/figures/ |

### Analysis pipeline (run once all 60 cells are complete)

```bash
cd /home/coder/experiments/l1/experiments
python3 analysis/scripts/build_dataset.py
python3 analysis/scripts/compute_metrics.py --dataset results/processed/dataset.parquet
python3 analysis/scripts/run_stats.py --metrics results/processed/metrics.parquet
python3 analysis/scripts/gen_figures.py \
  --metrics results/processed/metrics.parquet \
  --stats results/processed/stats_results.json
```

---

## Known bugs and fixes (already applied)

These were discovered and fixed during the session — do not re-apply, do not re-open.

| Bug | File | Fix |
|-----|------|-----|
| `int` not in eval namespace for AC grading | `harness/extract/grade_run.py:~77` | Added builtins to `local_ns` |
| Schema regex rejected uppercase in run IDs | `harness/schemas/run_record.schema.json` | Changed pattern to `[a-zA-Z0-9-]+` |
| sed/awk/wc classified as exec not nav | `harness/extract/adapters/codex.py` | Added to `NAV_COMMANDS` set |
| cmd_class at wrong dict level | `harness/extract/adapters/codex.py` | Moved inside `"input"` dict |
| file_change events unhandled → files_edited=[] | `harness/extract/adapters/codex.py` | Added file_change handler |
| Navigation counts zero for Codex | `harness/extract/extract_telemetry.py` | Pass 5 reads `tool_class == "nav"` |
| Absolute paths in files_edited | `harness/extract/extract_telemetry.py` | Added `_rel_path()` stripping workspace prefix |
| context_acquisition=0 for Codex (single-turn) | `harness/extract/extract_telemetry.py` | Fallback assigns `total_input` to orientation |
| TTFUA printed as "Nones" | `harness/extract/extract_telemetry.py` | Fixed format string |
| E5 nesting bug (cp -r E4 E5 created E5/E4/) | `harness/scripts/gen_environments.sh` | Changed to `cp -r E4/. E5/` |
| Base-repo docs polluting E0 | `harness/scripts/setup_run.sh` | Added strip step before overlay |
| Codex stdin blocking | `harness/scripts/run_experiment.sh` | Added `< /dev/null` to codex invocation |

### Known extraction quirks (not bugs, just be aware)

- **Single-turn token fallback**: Codex reports all tokens in one `turn.completed` at the end. The extractor assigns all of them to `phase_orientation_input` and sets impl/verif to 0. This is intentional.
- **wall_clock_seconds / time_to_first_edit_seconds = null for Codex**: Codex transcript events have no per-event timestamps, so timing fields are always null for Codex runs. Only Claude Code runs populate these.
- **files_edited may contain a spurious bash command string** (e.g. `"/bin/bash -lc 'mkdir -p tests'"`) — this is a known extractor edge case where a file_change event captures the mkdir that preceded a write. Not fixed yet.
- **No cache hits in Codex runs**: All 3 completed runs show 0 cached tokens. May be an account-level setting or Codex not using prompt caching. Not investigated.

---

## Directory structure

```
experiments/
├── handoff.md                        ← this file
├── monitor_pilot.py                  ← progress monitor (run in background)
├── harness/
│   ├── config.yaml                   ← agent configs, env definitions, task list
│   ├── tasks/T01.yaml … T10.yaml     ← task prompts + acceptance criteria
│   ├── envs/E0/ … E5/                ← overlay files for each environment
│   ├── e5_seeds/T01/ … T10/          ← episodic memory content for E5
│   ├── schemas/run_record.schema.json
│   ├── extract/
│   │   ├── extract_telemetry.py
│   │   ├── grade_run.py
│   │   ├── validate_schema.py
│   │   └── adapters/
│   │       ├── codex.py              ← Codex event parser
│   │       └── claude_code.py        ← Claude Code event parser
│   └── scripts/
│       ├── run_experiment.sh
│       ├── setup_run.sh
│       ├── teardown_run.sh
│       ├── gen_environments.sh       ← one-time; envs already generated
│       └── seed_e5_memory.sh         ← one-time; e5_seeds already populated
├── runs/
│   └── pilot-{TASK}-{ENV}-{AGENT}-{REP}/
│       ├── workspace/                ← git worktree (removed on teardown)
│       ├── transcript.jsonl          ← raw agent output
│       ├── run_meta.json             ← identity written before agent starts
│       ├── run_record.json           ← extracted telemetry (presence = run done)
│       └── agent_stderr.txt
├── results/
│   ├── raw/
│   └── processed/
│       ├── dataset.parquet
│       ├── metrics.parquet
│       ├── stats_results.json
│       └── figures/
│           ├── preliminary_T01_E0-E2.png   ← the only real figure so far
│           └── fig01…fig12 (generated by gen_figures.py)
├── analysis/scripts/
│   ├── build_dataset.py
│   ├── compute_metrics.py
│   ├── run_stats.py
│   └── gen_figures.py
└── target/
    └── xo-cowork-api.git             ← bare repo; source of all worktrees
```

---

## Resuming — step by step

1. **Decide on agent**: Codex (needs credits) or Claude Code (works now, different adapter).
2. **Clean up bad runs**:
   ```bash
   rm -rf runs/pilot-T01-E{3,4,5}-codex-001
   rm -rf runs/pilot-T02-E{0,1,2,3,4,5}-codex-001
   ```
3. **Launch pilot**:
   ```bash
   cd /home/coder/experiments/l1/experiments
   AGENT_ID=codex bash harness/scripts/run_experiment.sh
   # or: AGENT_ID=claude-sonnet-4-6 bash harness/scripts/run_experiment.sh
   ```
4. **Monitor progress** (separate terminal):
   ```bash
   cd /home/coder/experiments/l1/experiments
   python3 monitor_pilot.py
   ```
5. **When all 60 cells are done**, run analysis:
   ```bash
   python3 analysis/scripts/build_dataset.py
   python3 analysis/scripts/compute_metrics.py --dataset results/processed/dataset.parquet
   python3 analysis/scripts/run_stats.py --metrics results/processed/metrics.parquet
   python3 analysis/scripts/gen_figures.py \
     --metrics results/processed/metrics.parquet \
     --stats results/processed/stats_results.json
   ```
6. **Report results** — key metrics to surface:
   - Score by environment (E0–E5) — does more context raise success rates?
   - Token cost by environment — is there a clear downward trend?
   - Time to first edit by environment (Claude Code only, not Codex)
   - Navigation entropy by environment — does more context reduce exploratory thrashing?
   - Efficiency ratio (score / log tokens) — which env gives best value?
