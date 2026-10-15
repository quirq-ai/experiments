# Implementation Plan: Structured Agent Environments Experiment

**Version:** 1.0 — 2026-06-11
**For:** Engineer implementing the harness from scratch
**Status:** All files generated; ready for wiring and pilot run

---

## Quick-start (after reading this doc)

```bash
cd experiments/

# 1. Initialize bare clone (one-time)
git clone --bare ../xo-cowork-api target/xo-cowork-api.git

# 2. Generate environment overlays (one-time)
bash harness/scripts/gen_environments.sh

# 3. Install Python analysis deps
pip install -r analysis/requirements.txt

# 4. (Optional) Seed E5 memory for each task
for T in T01 T02 T03 T04 T05 T06 T07 T08 T09 T10; do
  TASK_ID=$T AGENT_ID=claude-sonnet-4-6 bash harness/scripts/seed_e5_memory.sh
done

# 5. Run pilot
AGENT_ID=claude-sonnet-4-6 bash harness/scripts/run_experiment.sh

# 6. Build dataset and analyse
python analysis/scripts/build_dataset.py  --runs-dir runs/ --output results/processed/dataset.parquet
python analysis/scripts/compute_metrics.py --dataset results/processed/dataset.parquet
python analysis/scripts/run_stats.py       --metrics results/processed/metrics.parquet
python analysis/scripts/gen_figures.py     --metrics results/processed/metrics.parquet \
                                            --stats results/processed/stats_results.json
```

---

## Component Registry

Every file in the harness, one line each.

```
experiments/
  harness/
    config.yaml                         Global config: SHA, paths, agents, envs, tasks
    envs/E{0-5}/                        Overlay files for each condition (git-committed)
    tasks/T{01-10}.yaml                 Task definitions (prompts + acceptance criteria)
    schemas/
      run_record.schema.json            JSON Schema for canonical per-run record
      task_definition.schema.json       JSON Schema for task YAML files
      event_log.schema.json             JSON Schema for per-event log lines
    scripts/
      run_experiment.sh                 Outer loop: task × env matrix orchestrator
      setup_run.sh                      Per-run: worktree + overlay + hooks + run_meta.json
      teardown_run.sh                   Per-run: patch + transcript + grade + telemetry extraction
      gen_environments.sh               One-time: builds all 6 env overlay trees
      seed_e5_memory.sh                 Per-task: synthetic E4 session → E5 memory seed
      hooks/
        log_tool_event.sh               Claude Code hook: sub-second tool event logger
        settings_template.json          Claude Code settings snippet with hook commands
    extract/
      __init__.py
      extract_telemetry.py              transcript.jsonl → run_record.json + event_log.jsonl
      grade_run.py                      workspace + task YAML → grade.json
      validate_schema.py                run_record.json × schema → pass/fail
      adapters/
        __init__.py                     Adapter registry: provider → normalize function
        claude_code.py                  Claude Code JSONL → NormalizedEvent list
        codex.py                        Codex conversation.json → NormalizedEvent list
  analysis/
    requirements.txt                    Python deps for analysis pipeline
    scripts/
      build_dataset.py                  runs/*/run_record.json → dataset.parquet
      compute_metrics.py                dataset.parquet → metrics.parquet (+ derived cols)
      run_stats.py                      metrics.parquet → stats_results.json
      gen_figures.py                    metrics.parquet + stats → 12 figures (PDF + PNG)
    notebooks/                          Jupyter notebooks (manual exploration)
  target/
    xo-cowork-api.git                   Bare clone (created by engineer; not in git)
  runs/
    {run_id}/                           Per-run artifacts (created at runtime)
  results/
    raw/                                Concatenated JSONL of all run_records
    processed/                          Parquet files and figures
  setup-docs/
    experiment-spec.md                  Full research specification
    implementation-plan.md              This document
```

---

## Component Specifications

### 1. harness/config.yaml

**Responsibility:** Single source of truth for all experiment parameters.
Changing the BASE_SHA here propagates to every script via environment or
direct read. Add new agents/environments here — scripts read from it.

**Inputs:** Manual (engineer sets BASE_SHA, adds agents, etc.)
**Outputs:** Read by all shell scripts and Python modules

**Key fields:**
- `experiment.base_sha` — pinned SHA all worktrees use (NEVER change mid-experiment)
- `paths.*` — all relative paths resolved from `experiments/` root
- `agents[].transcript_glob` — pattern for locating transcript after run
- `environments.E5.overlay_files[-1].src` — points to `e5_seeds/{task_id}/memory`

---

### 2. harness/scripts/gen_environments.sh

**Responsibility:** Build all 6 env overlay trees from the XO project template.
Run once before the experiment. Safe to re-run (idempotent via overwrite).

**Inputs:**
- `TEMPLATE_DIR` — `xo-cowork-api/services/cowork_agent/project_template`
- `TARGET_REPO` — `xo-cowork-api/` (for README content)
- `ENVS_DIR` — `harness/envs/`

**Outputs:**
- `harness/envs/E0/` — `.gitkeep` only
- `harness/envs/E1/README.md` — auto-generated from PROJECT.md + xo-cowork-api conventions
- `harness/envs/E2/AGENTS.md` — template AGENTS.md verbatim
- `harness/envs/E3/{AGENTS.md, PROJECT.md}` — with `[TEMPLATE]` markers filled
- `harness/envs/E4/` — full XO skeleton, empty memory
- `harness/envs/E5/` — same as E4 (seeds merged at run time by setup_run.sh)
- `harness/e5_seeds/{task_id}/` — placeholder dirs for E5 seeds

**Key implementation notes:**
- `sed` fills `[TEMPLATE]` markers in PROJECT.md with xo-cowork-api specifics
- E1 README is hand-crafted to match information density of PROJECT.md without agent-operating-contract structure
- E5 overlay = E4 skeleton; seed memory merged per-run in setup_run.sh

---

### 3. harness/scripts/setup_run.sh

**Responsibility:** Prepare one isolated run. Called once per (task, env) cell.

**Inputs (env vars):**
- `TASK_ID`, `ENV_ID`, `AGENT_ID`, `RUN_ID`, `REPLICATION`, `EXPERIMENT_ID`

**Outputs:**
- `runs/{RUN_ID}/workspace/` — git worktree at BASE_SHA with overlay applied
- `runs/{RUN_ID}/run_meta.json` — identity + timestamp_start

**Key implementation notes:**
- `git --git-dir=target/xo-cowork-api.git worktree add --detach workspace {BASE_SHA}`
  → every env gets the **same source snapshot**; overlay is the only difference
- E5: after copying E4 overlay, merges `harness/e5_seeds/{TASK_ID}/memory/` on top
- Claude Code hook injection: backs up `~/.claude/settings.json`, merges hook config,
  restores on teardown. Hook reads `EXPERIMENT_RUN_ID` env var to know where to write.
- `env_overlay_hash` is SHA-256 of all overlay files — records exact overlay state for reproducibility

**Prerequisite:** `target/xo-cowork-api.git` must exist:
```bash
git clone --bare ../xo-cowork-api target/xo-cowork-api.git
```

---

### 4. harness/scripts/teardown_run.sh

**Responsibility:** Collect all artifacts after agent exits; run grader and extractor; remove worktree.

**Inputs (env vars):**
- `RUN_ID`, `AGENT_EXIT_CODE`
- Reads `runs/{RUN_ID}/run_meta.json` for task_id, agent_id

**Outputs:**
- `runs/{RUN_ID}/git.patch` — unified diff (new files appended via `/dev/null` diff)
- `runs/{RUN_ID}/transcript.jsonl` — copied from agent's session dir
- `runs/{RUN_ID}/grade.json` — from grade_run.py
- `runs/{RUN_ID}/run_record.json` — from extract_telemetry.py
- `runs/{RUN_ID}/event_log.jsonl` — from extract_telemetry.py

**Transcript location logic (Claude Code):**
Claude Code stores sessions under `~/.claude/projects/{base64(workspace_path)}/`.
teardown_run.sh computes the hash the same way Claude Code does and copies the
most recently modified `.jsonl` file from that directory.

**Error handling:** Grader and extractor failures do not abort teardown.
A sentinel grade.json is written on extractor failure so downstream analysis
can detect and flag incomplete records.

---

### 5. harness/scripts/run_experiment.sh

**Responsibility:** Outer loop. Iterates task × env, calls setup → agent → teardown.
Skips runs where `run_record.json` already exists (resume-safe).

**Inputs (env vars):**
- `AGENT_ID` (required)
- `TASK_FILTER`, `ENV_FILTER` (optional comma-separated subsets)
- `DRY_RUN=1` for dry run

**Outputs:**
- Populates `runs/*/` via setup/teardown
- Appends each completed run_record to `results/raw/{experiment_id}_runs.jsonl`

**Parallelization:** Set `TASK_FILTER` and `ENV_FILTER` to split matrix across machines:
```bash
# Machine A: first 5 tasks
AGENT_ID=... TASK_FILTER=T01,T02,T03,T04,T05 ./harness/scripts/run_experiment.sh
# Machine B: last 5 tasks
AGENT_ID=... TASK_FILTER=T06,T07,T08,T09,T10 ./harness/scripts/run_experiment.sh
```

---

### 6. harness/scripts/hooks/log_tool_event.sh

**Responsibility:** Claude Code PreToolUse/PostToolUse/Stop hook.
Writes one JSON line per tool event to `runs/{RUN_ID}/hook_events.jsonl`.
Provides sub-millisecond wall-clock timestamps not available in transcript.

**Inputs:**
- `$1` — hook type: `pre` | `post` | `stop`
- stdin — JSON payload from Claude Code hook system
- `EXPERIMENT_RUN_ID`, `EXPERIMENT_RUNS_DIR` — set by setup_run.sh

**Outputs:**
- `runs/{RUN_ID}/hook_events.jsonl` — appended (one line per event)

**Critical:** Must exit 0 always. Non-zero exit blocks the agent.

**Hook event schema:**
```json
{"ts": "2026-06-11T10:00:41.123Z", "hook": "pre", "tool": "Edit", "input_summary": "...", "exit_code": null}
```

---

### 7. harness/scripts/hooks/settings_template.json

**Responsibility:** Template Claude Code settings that installs the three hooks.
`__HOOK_SCRIPT__` and `__RUN_DIR__` are substituted by setup_run.sh at install time.

**Inputs:** Written by engineer; `__HOOK_SCRIPT__` → absolute path to log_tool_event.sh
**Outputs:** Merged into `~/.claude/settings.json` by setup_run.sh

---

### 8. harness/scripts/seed_e5_memory.sh

**Responsibility:** Generate pre-seeded memory files for E5 condition.
Runs a short "exploration-only" agent session in E4 condition, extracts memory/ files written by the agent.

**Inputs (env vars):** `TASK_ID`, `AGENT_ID`
**Outputs:** `harness/e5_seeds/{TASK_ID}/memory/` tree (committed to experiment repo)

**Run once per task before main experiment.** Idempotent: exits early if seed already populated.

**Seed prompt strategy:** Asks agent to explore codebase + populate memory only (no implementation).
Session is capped at 900 seconds. Seed run is NOT included in analysis dataset.

---

### 9. harness/extract/extract_telemetry.py

**Responsibility:** Core extraction engine. Parses transcript → run_record.json + event_log.jsonl.

**Inputs:**
- `--transcript transcript.jsonl`
- `--task-file T01.yaml`
- `--run-meta run_meta.json`
- `--grade grade.json`
- `--output run_record.json`
- `--event-log event_log.jsonl`

**Outputs:**
- `run_record.json` — validated canonical record
- `event_log.jsonl` — one line per tool event with cumulative token counter

**Key logic (5 passes):**
1. Build flat event log with tool classification and `is_edit` flag
2. Aggregate token totals (input/output/cache) from assistant messages
3. Compute timing: wall clock, TTFUA, phase boundaries
4. Compute phase token costs (orientation / implementation / verification)
5. Compute navigation: file read sequence, Shannon entropy (pre-edit and full), memory/xo reads

**Tool classification** (`classify_tool(tool_name, tool_input)` → str):
```
"edit"   → Edit, Write, NotebookEdit
"nav"    → Read
"search" → Bash where cmd contains grep/find/rg/ag
"git_op" → Bash where cmd starts with "git "
"exec"   → Bash (other)
"web"    → WebSearch, WebFetch
"agent"  → Agent
"meta"   → everything else
```

**Extending for new agents:** Add a new adapter in `harness/extract/adapters/` and register
it in `adapters/__init__.py`. The extractor is provider-agnostic from Pass 1 onwards.

---

### 10. harness/extract/adapters/claude_code.py

**Responsibility:** Parse Claude Code JSONL transcript lines → list of NormalizedEvent.

**Inputs:** `list[str]` — raw JSONL lines from Claude Code session file
**Outputs:** `list[NormalizedEvent]` — normalized, provider-agnostic event objects

**NormalizedEvent fields:**
```python
seq: int           # line index in transcript
ts: str            # ISO8601 timestamp
role: str          # "user" | "assistant"
tokens_in: int     # from usage.input_tokens
tokens_out: int    # from usage.output_tokens
cache_read: int
cache_write: int
tools: list[dict]  # [{name, input, tool_use_id}] from content blocks
raw_content: list  # original content array
message_uuid: str
```

**Format notes:**
- Tool use blocks are in `message.content[*]` of assistant messages
- Tool results are in `message.content[*]` of subsequent user messages (role inference needed)
- Cache tokens are in `usage.cache_read_input_tokens` / `usage.cache_creation_input_tokens`

---

### 11. harness/extract/adapters/codex.py

**Responsibility:** Parse Codex conversation.json → list of NormalizedEvent.

**Inputs:** `list[str]` — either a JSON array (single file) or JSONL
**Outputs:** `list[NormalizedEvent]`

**Format notes:**
- Codex may write a single JSON array, not JSONL. Adapter tries array parse first.
- Tool calls are in `turn.tool_calls[*].function.{name, arguments}`
- `arguments` is a JSON-encoded string (double-encoded) — adapter unescapes it
- No cache tokens available from Codex (cache_read=0, cache_write=0)

---

### 12. harness/extract/grade_run.py

**Responsibility:** Run automated acceptance criteria against workspace; produce grade.json.

**Inputs:**
- `--workspace` — path to agent's worktree (must still exist)
- `--task` — task YAML path
- `--run-id` — for labelling
- `--agent-exit-code` — agent process exit code

**Outputs:**
- `grade.json` with `score_automated`, `terminal_state`, `ac_results`

**AC type implementations:**
- `shell` — run command via `subprocess.run(shell=True)`, evaluate `pass_condition` string
- `pytest` — same as shell (command is pytest invocation)
- `regex` — run command, match `pass_condition` as regex against stdout+stderr
- `ast_check` — run command, parse stdout as JSON with `{"passed": bool}` schema

**terminal_state logic:**
```
exit_code 124 → "timeout"
exit_code not in (0,1) → "error"
score == 1.0 → "completed"
score == 0.0 → "failed"
0 < score < 1.0 → "partial"
```

**Warning:** Grade runs against workspace **before** worktree removal. teardown_run.sh
calls grade_run.py before removing the worktree.

---

### 13. harness/extract/validate_schema.py

**Responsibility:** Validate run_record.json against JSON Schema. Exits non-zero on failure.

**Inputs:** `--record run_record.json`, `--schema run_record.schema.json`
**Outputs:** stdout validation report; exit code 0=valid, 1=invalid, 2=missing jsonschema

**Dependency:** `pip install jsonschema`
teardown_run.sh calls this after extraction; schema failures are logged but do not
abort teardown (the record is still preserved for inspection).

---

### 14. harness/schemas/run_record.schema.json

**Responsibility:** JSON Schema (Draft 2020-12) governing every run_record.json.
Enforces required fields, types, enum constraints, and minimum values.

**Key constraints:**
- `condition.env_id` ∈ `["E0","E1","E2","E3","E4","E5"]`
- `outcome.terminal_state` ∈ `["completed","partial","failed","timeout","error"]`
- All token fields: integer ≥ 0
- `navigation.files_read_sequence`: array of strings (capped at 200 for storage)
- `token_curve`: array of [seq, cumulative_input] pairs

**Schema versioning:** `schema_version: "1"` is a `const` — bump when fields change.
Old records (version 0) must be migrated before analysis scripts can read them.

---

### 15. harness/tasks/T{01-10}.yaml

**Responsibility:** Task definitions. One file per task. Schema-governed.

**Field responsibilities:**
- `prompt` — verbatim text sent to the agent. Must be self-contained: no implicit
  context about the codebase (agents in E0 get no context files, so the prompt
  cannot assume any repo knowledge).
- `acceptance_criteria.automated` — must be runnable without human intervention.
  All commands run inside `workspace/` via `subprocess.run(shell=True, cwd=workspace)`.
- `reference_files` — files the grader uses to check nav_efficiency (how quickly
  agent found the right files). Also used to inform task design.
- `ground_truth_tokens` — filled after pilot from E0 median. Used to compute
  efficiency ratio relative to baseline.

**Calibration loop:** After pilot, review tasks where all environments produce
near-identical outcomes (ceiling or floor effect). Revise difficulty or replace.

---

### 16. analysis/scripts/build_dataset.py

**Responsibility:** Scan runs/ directory, flatten all run_record.json files to a
pandas DataFrame, save as Parquet.

**Inputs:**
- `--runs-dir runs/`
- `--raw-file results/raw/pilot_runs.jsonl` (optional supplement)
- `--output results/processed/dataset.parquet`

**Outputs:** `dataset.parquet` — one row per run, flat columns

**Added columns beyond run_record fields:**
- `category` — from TASK_META lookup dict (feature/bugfix/refactor/test/documentation)
- `difficulty` — from TASK_META
- `difficulty_num` — 1/2/3 for easy/medium/hard (ordinal for regression)
- `success` — binary (1 if score_automated == 1.0)
- `env_id` — ordered Categorical (E0 < E1 < ... < E5)

**Deduplication:** Skips records with duplicate run_id when merging from multiple sources.

---

### 17. analysis/scripts/compute_metrics.py

**Responsibility:** Load dataset.parquet, compute derived metrics, save metrics.parquet.

**Inputs:** `--dataset results/processed/dataset.parquet`
**Outputs:** `metrics.parquet` (same rows, additional columns)

**Derived columns:**

| Column | Formula | Note |
|--------|---------|------|
| `total_token_cost` | total_input + total_output | Raw cost metric |
| `log_total_input` | log₂(1 + total_input) | For regression (log-scale) |
| `efficiency_ratio` | score_automated / log₂(1 + total_input) | Primary quality/cost metric |
| `nav_efficiency` | files_edited_count / file_reads_total | How targeted was navigation |
| `opts` | phase_orient_input / total_input | Orientation token share |
| `replanning_rate` | replanning_events / (wall_clock_hours) | Rate per hour |
| `memory_utilization_rate` | (mem_reads + mem_writes) / tool_calls | MUR (E4/E5 only meaningful) |
| `cac_ratio` | context_acquisition / total_input | Fraction spent orienting |

---

### 18. analysis/scripts/run_stats.py

**Responsibility:** Execute all statistical tests; write stats_results.json.

**Inputs:** `--metrics results/processed/metrics.parquet`
**Outputs:** `results/processed/stats_results.json`

**Tests executed:**

| Test | When | Metric |
|------|------|--------|
| Kruskal-Wallis (omnibus) | Always | All PRIMARY_METRICS |
| Dunn pairwise (Holm-Bonferroni) | If scikit-posthocs installed | All PRIMARY_METRICS |
| Wilcoxon signed-rank E4 vs E5 | Always | All PRIMARY_METRICS (paired by task_id) |
| Bootstrap BCa CI (10k samples) | Always | Median per env per metric |
| Cohen's d | Always | Key pairs: (E0,E4),(E0,E5),(E2,E4),(E4,E5) |
| Cliff's delta | Always | Same pairs |

**Reproducibility:** `np.random.seed(42)` before bootstrap sampling.

**Pilot limitation:** With n=10 per env (1 replication), all tests are under-powered.
stats_results.json will contain results but they should NOT be reported as significant.
Run the full experiment (n≥30 per env) before making significance claims.

---

### 19. analysis/scripts/gen_figures.py

**Responsibility:** Generate all 12 paper figures from metrics.parquet.

**Inputs:**
- `--metrics results/processed/metrics.parquet`
- `--stats results/processed/stats_results.json` (optional)
- `--output-dir results/processed/figures/`

**Outputs:** `fig{01-12}_*.{pdf,png}` — one PDF+PNG pair per figure

**Figure 11 and 12 limitation:** Token curves and file heatmaps require fields not
in the flat parquet (`token_curve`, `files_read_sequence`). These are placeholders
in gen_figures.py. Full implementation:
- Figure 11: Load `token_curve` from each run_record.json, normalize x-axis to [0,1],
  compute median + IQR per env, plot seaborn lineplot.
- Figure 12: Load `files_read_sequence` from each run_record.json, filter to pre-edit
  events, count by (file_path, env_id), pivot to heatmap, seaborn heatmap.

Both can be implemented in `analysis/notebooks/01_eda.ipynb`.

**Font note:** Uses `matplotlib.use("Agg")` for headless rendering. Install
`matplotlib` and `seaborn` from analysis/requirements.txt.

---

## Data Flow Diagram

```
xo-cowork-api (BASE_SHA)
        │
        ▼
gen_environments.sh ──────────────────────► harness/envs/E{0-5}/
        │                                   harness/e5_seeds/{task_id}/
        │
        ▼
seed_e5_memory.sh (per task, once)
        │
        ▼
run_experiment.sh
  ├─ for each (task, env):
  │    setup_run.sh
  │      ├─ git worktree add (same SHA, all envs)
  │      ├─ copy overlay from harness/envs/{env_id}/
  │      ├─ (E5) merge e5_seeds/{task_id}/memory/
  │      ├─ install Claude Code hooks
  │      └─ write run_meta.json
  │
  │    AGENT RUNS HERE
  │      ├─ reads workspace/
  │      ├─ writes transcript to ~/.claude/projects/{hash}/
  │      └─ hooks write hook_events.jsonl in real-time
  │
  │    teardown_run.sh
  │      ├─ git diff → git.patch
  │      ├─ copy transcript → transcript.jsonl
  │      ├─ grade_run.py → grade.json
  │      ├─ extract_telemetry.py → run_record.json + event_log.jsonl
  │      ├─ validate_schema.py → validation report
  │      └─ git worktree remove
  │
  └─ append run_record.json → results/raw/pilot_runs.jsonl
        │
        ▼
build_dataset.py ──────────────────────────► results/processed/dataset.parquet
        │
        ▼
compute_metrics.py ────────────────────────► results/processed/metrics.parquet
        │
        ├─► run_stats.py ──────────────────► results/processed/stats_results.json
        │
        └─► gen_figures.py ────────────────► results/processed/figures/fig{01-12}.*
```

---

## Pre-Flight Checklist

Before running the pilot, verify:

- [ ] `target/xo-cowork-api.git` exists (`git clone --bare ../xo-cowork-api target/xo-cowork-api.git`)
- [ ] `harness/envs/` populated (`bash harness/scripts/gen_environments.sh`)
- [ ] All 10 task YAMLs validate (`python harness/extract/validate_schema.py --record ... --schema harness/schemas/task_definition.schema.json`)
- [ ] `claude` binary is in PATH and authenticated
- [ ] `analysis/requirements.txt` installed in active venv
- [ ] `runs/` and `results/` directories exist (created by `mkdir -p` in scripts)
- [ ] `EXPERIMENT_RUN_ID` and `EXPERIMENT_RUNS_DIR` are exported before agent launch (done by `run_experiment.sh`)

---

## Extending to a New Agent

1. Add adapter: `harness/extract/adapters/{agent_name}.py` implementing `normalize(lines) → list[NormalizedEvent]`
2. Register: `adapters/__init__.py` — add to `PROVIDER_ADAPTERS`
3. Add to `config.yaml` under `agents:` with binary, flags, and transcript_glob
4. Add transcript-copy logic to `teardown_run.sh` under `elif [[ "$AGENT_ID" == "{agent_name}" ]]`
5. Add agent invocation to `run_experiment.sh`

No other changes needed — extractor, grader, analysis scripts, and schemas are all agent-agnostic.

---

## Extending to a New Repository

1. Create a new bare clone: `git clone --bare ../new-repo target/new-repo.git`
2. Update `config.yaml`: `target_repo`, `base_sha`
3. Fill `harness/envs/E3/PROJECT.md` with repo-specific content (sed replacements in gen_environments.sh)
4. Write 10 new task YAMLs in `harness/tasks/`
5. Re-run `gen_environments.sh` and `seed_e5_memory.sh`
6. Run experiment with new `EXPERIMENT_ID` to avoid collision with xo-cowork-api runs
