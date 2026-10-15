# Experiment Specification: Structured Agent Environments for Autonomous Coding

**Version:** 1.0 — 2026-06-11
**Research Question:** How does environment structure affect autonomous coding agent efficiency, navigation behavior, context acquisition cost, and task completion?

---

## 1. Experimental Architecture

### 1.1 Folder Structure

```
experiments/
├── setup-docs/                        # Spec + implementation plan (this file)
├── harness/
│   ├── config.yaml                    # BASE_SHA, paths, agent configs
│   ├── envs/                          # Environment overlay templates
│   │   ├── E0/                        # Empty — no overlay files
│   │   ├── E1/README.md
│   │   ├── E2/AGENTS.md
│   │   ├── E3/{AGENTS.md,PROJECT.md}
│   │   ├── E4/{full XO skeleton}
│   │   └── E5/{full XO + seeded memory}
│   ├── tasks/
│   │   ├── schema.json
│   │   └── T01.yaml ... T10.yaml
│   ├── scripts/
│   │   ├── setup_run.sh
│   │   ├── teardown_run.sh
│   │   ├── run_experiment.sh
│   │   ├── gen_environments.sh
│   │   ├── seed_e5_memory.sh
│   │   └── hooks/
│   │       ├── log_tool_event.sh
│   │       └── settings_template.json
│   ├── extract/
│   │   ├── extract_telemetry.py
│   │   ├── grade_run.py
│   │   ├── validate_schema.py
│   │   └── adapters/
│   │       ├── claude_code.py
│   │       └── codex.py
│   └── schemas/
│       ├── run_record.schema.json
│       ├── task_definition.schema.json
│       └── event_log.schema.json
├── target/                            # Bare clone of target repo
├── runs/
│   └── {run_id}/                      # One directory per run
│       ├── workspace/                 # Isolated worktree (deleted post-extraction)
│       ├── transcript.jsonl           # Agent transcript (raw)
│       ├── git.patch                  # git diff of all changes made
│       ├── run_meta.json              # Run identity (written by setup_run.sh)
│       ├── run_record.json            # Extracted telemetry (canonical record)
│       ├── event_log.jsonl            # Per-event log (from extract_telemetry.py)
│       ├── hook_events.jsonl          # Sub-second timing from hooks
│       └── grade.json                 # Grader output
├── results/
│   ├── raw/
│   │   └── pilot_runs.jsonl           # All run_records concatenated
│   └── processed/
│       ├── dataset.parquet            # Flat analysis table
│       ├── metrics.parquet            # With derived metrics
│       ├── stats_results.json         # Statistical test results
│       └── figures/
└── analysis/
    ├── requirements.txt
    ├── scripts/
    │   ├── build_dataset.py
    │   ├── compute_metrics.py
    │   ├── run_stats.py
    │   └── gen_figures.py
    └── notebooks/
        ├── 01_eda.ipynb
        ├── 02_primary_metrics.ipynb
        ├── 03_statistical_tests.ipynb
        └── 04_figures.ipynb
```

### 1.2 Environment Generation Strategy

Each environment is a **git worktree** cloned from a pinned SHA of the target repository,
with overlay files written before the agent is invoked. The overlay is additive — source
code is never modified by environment setup. All six conditions share exactly the same
source code snapshot.

**Overlay rules per condition:**

| Condition | Overlay Files | Pre-seeded Memory | CLAUDE.md |
|-----------|--------------|-------------------|-----------|
| E0 | none | no | no |
| E1 | README.md (auto-generated from PROJECT.md) | no | no |
| E2 | AGENTS.md | no | no |
| E3 | AGENTS.md, PROJECT.md | no | no |
| E4 | AGENTS.md, CLAUDE.md, PROJECT.md, OBJECTIVES.md, PLAN.md, PROGRESS.md, memory/ skeleton | no | yes |
| E5 | E4 full tree | yes — semantic + 2 episodic + 1 procedural from a prior synthetic session | yes |

**E5 memory seeding:** Pre-seeded memory files are written once per task by a separate
synthetic "seed run" in E4 condition, then frozen. The seed run is not counted in analysis.

**E1 README generation:** A script auto-generates a concise README from the same PROJECT.md
used in E3+, ensuring equivalent information density without the agent-operating-contract.

### 1.3 Branch Strategy

```
target repo: pinned to BASE_SHA (4e09644cab6f2ac4a2b91573fb670a0546f69cd4)
  └── git worktree add runs/{run_id}/workspace {BASE_SHA}   (ephemeral, no branch created)
```

- One bare clone at `target/xo-cowork-api.git` is shared across all runs (read-only).
- Each run calls `git worktree add` against the bare clone.
- After extraction, the worktree is removed. The patch is preserved.
- BASE_SHA is pinned in `harness/config.yaml` and never changes mid-experiment.

### 1.4 Task Definition Format

```yaml
schema_version: "1"
task_id: T01
title: "Add GET /health/deep endpoint"
category: feature          # feature | bugfix | refactor | test | documentation
difficulty: easy           # easy | medium | hard
max_seconds: 1800

prompt: |
  Add a new endpoint GET /health/deep to the FastAPI application...

acceptance_criteria:
  automated:
    - id: AC1
      type: pytest           # pytest | shell | regex | ast_check
      command: "pytest tests/test_health_deep.py -q"
      pass_condition: "exit_code == 0"
    - id: AC2
      type: shell
      command: "grep -r 'health/deep' routers/ --include='*.py' | wc -l"
      pass_condition: "int(stdout.strip()) >= 1"
  human:
    - id: AC3
      description: "Endpoint follows existing router module structure"
      rubric: binary

reference_files:
  - routers/status/providers.py
  - routers/status/__init__.py

ground_truth_tokens:
  E0_median: null
  oracle_min: null
```

---

## 2. Instrumentation Plan

### 2.1 Metrics and Collection Mechanisms

All primary metrics are extracted from the agent transcript (JSONL). No instrumentation
hooks are injected into the agent itself — extraction is purely post-hoc.

#### Claude Code Transcript Location

`~/.claude/projects/{base64_path_hash}/{session_id}.jsonl`

Each line is a JSON object. Tool use blocks are within `content` arrays of assistant
messages. Tool results are user-role messages with `tool_result` content blocks.

### 2.2 Metric → Collection Mapping

| Metric | Source | Extraction Logic |
|--------|--------|-----------------|
| total_input_tokens | usage.input_tokens | Sum across all assistant messages |
| total_output_tokens | usage.output_tokens | Sum across all assistant messages |
| cache_read_tokens | usage.cache_read_input_tokens | Sum across all assistant messages |
| cache_write_tokens | usage.cache_creation_input_tokens | Sum |
| wall_clock_seconds | timestamp first/last | last_ts - first_ts |
| time_to_first_edit_seconds | first Edit/Write tool call | ts(first_edit) - ts(first_message) |
| context_acquisition_tokens | usage before first edit | Sum of input_tokens before first Edit/Write |
| file_reads | Read tool calls | Count + list of paths |
| file_edits | Edit + Write tool calls | Count + list of paths |
| bash_calls | Bash tool calls | Count + command strings |
| search_calls | Bash matching grep/find/rg/ag | Filtered from bash_calls |
| git_calls | Bash matching ^git | Filtered from bash_calls |
| agent_spawns | Agent tool calls | Count + subagent_type |
| nav_file_sequence | Ordered list of Read paths | Raw sequence for entropy |
| replanning_events | Edit calls touching PLAN.md | Count |
| memory_reads | Read calls to memory/ paths | Count (E4/E5 only) |
| memory_writes | Edit/Write calls to memory/ paths | Count (E4/E5 only) |
| terminal_state | Last message + grade | completed/failed/timeout/error |

### 2.3 Log Formats

**Per-event log** (event_log.jsonl):
```json
{"seq": 0, "ts": "2026-06-11T10:00:00Z", "role": "user", "tokens_in": 4200, "tokens_out": 0, "tool": null, "tool_input": null, "is_edit": false, "tool_class": null}
{"seq": 7, "ts": "2026-06-11T10:00:41Z", "role": "assistant", "tokens_in": 6100, "tokens_out": 89, "tool": "Edit", "tool_input": {"file_path": "routers/health.py"}, "is_edit": true, "tool_class": "edit"}
```

**Hook event log** (hook_events.jsonl) — sub-second timing from Claude Code hooks:
```json
{"ts": "2026-06-11T10:00:41.123Z", "hook": "PreToolUse", "tool": "Edit", "input_summary": "routers/health.py"}
```

---

## 3. Telemetry System

### 3.1 Tool Classification

| Class | Tools | Pattern |
|-------|-------|---------|
| nav | Read | All Read calls |
| edit | Edit, Write, NotebookEdit | Any file modification |
| search | Bash (grep/find/rg/ag/cat) | Command regex match |
| git_op | Bash (^git ) | Command starts with "git " |
| exec | Bash (other) | Remaining Bash calls |
| web | WebSearch, WebFetch | Web access |
| agent | Agent | Sub-agent spawn |
| meta | all others | Default |

### 3.2 Phase Segmentation

Three phases based on event boundaries:
- **Orientation**: seq 0 → first_edit_seq (exclusive)
- **Implementation**: first_edit_seq → last_edit_seq (inclusive)
- **Verification**: after last_edit_seq → end

Token cost and wall-clock duration reported per phase.

### 3.3 Navigation Entropy

Shannon entropy over unique file access distribution:

```python
from collections import Counter
import math
counts = Counter(file_reads_before_first_edit)
total = sum(counts.values())
probs = [c / total for c in counts.values()]
nav_entropy_pre_edit = -sum(p * math.log2(p) for p in probs if p > 0)
```

High entropy = broad unfocused navigation. Expected ordering:
NE(E0) > NE(E1) > NE(E2) ≈ NE(E3) > NE(E4) ≈ NE(E5)

---

## 4. Dataset Schema

### 4.1 run_record.json — Canonical Per-Run Record

```json
{
  "schema_version": "1",
  "run": {
    "run_id": "pilot-T01-E3-claude-sonnet-4-6-001",
    "experiment_id": "pilot",
    "batch_id": "2026-06-15",
    "replication": 1,
    "timestamp_start": "2026-06-15T09:00:00Z",
    "timestamp_end": "2026-06-15T09:14:22Z"
  },
  "condition": {
    "task_id": "T01",
    "env_id": "E3",
    "agent_id": "claude-sonnet-4-6",
    "agent_provider": "anthropic",
    "base_repo_sha": "4e09644cab6f2ac4a2b91573fb670a0546f69cd4",
    "env_overlay_hash": "sha256:..."
  },
  "outcome": {
    "terminal_state": "completed",
    "score_automated": 1.0,
    "score_human": null,
    "ac_results": {}
  },
  "tokens": {
    "total_input": 42100,
    "total_output": 6800,
    "cache_read": 18400,
    "cache_write": 5200,
    "total_effective": 47000,
    "context_acquisition": 28300,
    "phase_orientation_input": 28300,
    "phase_implementation_input": 11200,
    "phase_verification_input": 2600
  },
  "timing": {
    "wall_clock_seconds": 862,
    "time_to_first_edit_seconds": 224,
    "phase_orientation_seconds": 224,
    "phase_implementation_seconds": 581,
    "phase_verification_seconds": 57
  },
  "navigation": {
    "file_reads_total": 18,
    "file_reads_unique": 11,
    "nav_entropy": 3.24,
    "nav_entropy_pre_edit": 2.87,
    "files_read_sequence": ["AGENTS.md", "PROJECT.md", "routers/status/__init__.py"],
    "files_edited": ["routers/health_deep.py", "routers/__init__.py"],
    "memory_reads": 2,
    "memory_writes": 1,
    "xo_reads": 0,
    "agents_md_read": true,
    "project_md_read": true
  },
  "operations": {
    "tool_calls_total": 47,
    "bash_calls": 12,
    "search_calls": 5,
    "git_calls": 3,
    "web_searches": 0,
    "agent_spawns": 0,
    "replanning_events": 0,
    "message_count": 23
  },
  "token_curve": [[0, 0], [1, 4200], [2, 8750], [7, 28300]],
  "raw": {
    "transcript_path": "runs/pilot-T01-E3-claude-sonnet-4-6-001/transcript.jsonl",
    "patch_path": "runs/pilot-T01-E3-claude-sonnet-4-6-001/git.patch",
    "grade_path": "runs/pilot-T01-E3-claude-sonnet-4-6-001/grade.json"
  }
}
```

---

## 5. Evaluation Metrics

### 5.1 Primary

| Metric | Symbol | Formula | Expected Direction |
|--------|--------|---------|-------------------|
| Success Rate | SR | mean(score_automated) | Higher with more structure |
| Token Cost | TC | total_input + total_output | Lower with more structure |
| Wall Clock Time | WCT | wall_clock_seconds | Lower with more structure |
| Context Acquisition Cost | CAC | context_acquisition_tokens | Lower with more structure |
| Navigation Entropy | NE | Shannon entropy, pre-edit file reads | Lower with more structure |
| Time to First Useful Action | TTFUA | time_to_first_edit_seconds | Lower with more structure |
| Replanning Frequency | RF | replanning_events / (wct / 3600) | Lower with more structure |
| Memory Utilization Rate | MUR | (mem_reads+mem_writes)/tool_calls_total | E5 > E4, others 0 |

### 5.2 Derived

| Metric | Formula |
|--------|---------|
| Efficiency Ratio (ER) | score_automated / log2(1 + total_input_tokens) |
| Navigation Efficiency (NavEff) | files_edited_relevant / file_reads_total |
| Orientation Phase Token Share (OPTS) | phase_orientation_input / total_input |

---

## 6. Statistical Analysis Plan

### 6.1 Sample Sizes

Power analysis (Kruskal-Wallis, α=0.05, power=0.80, η²=0.06):
- Required n per group: ≥ 26 observations
- Full experiment: 6 envs × 10 tasks × 2 agents × 3 replications = **360 runs**
- Pilot (exploratory): 6 envs × 10 tasks × 1 agent × 1 replication = **60 runs**

### 6.2 Significance Testing

| Comparison | Test | Correction |
|-----------|------|-----------|
| Any env effect | Kruskal-Wallis | None (omnibus) |
| Pairwise env × env | Dunn's test | Holm-Bonferroni |
| Success rate difference | Fisher's exact | Holm-Bonferroni |
| Agent × env interaction | Aligned Ranks ANOVA | None |
| E4 vs E5 memory effect | Wilcoxon signed-rank | None (pre-specified) |

### 6.3 Effect Sizes

| Type | Measure | Thresholds |
|------|---------|-----------|
| Continuous (TC, WCT) | Cohen's d (log-scale) | small 0.2, medium 0.5, large 0.8 |
| Ordinal (SR) | Cliff's delta | neg <0.15, small 0.15-0.33, medium 0.33-0.47, large >0.47 |
| Multi-group | η² | small 0.01, medium 0.06, large 0.14 |

Bootstrap CIs: BCa method, 10,000 samples, [2.5%, 97.5%].

### 6.4 Primary Model

```
log(TC) ~ env_id + agent_id + task_difficulty + env_id:agent_id + (1 | task_id)
SR      ~ env_id + agent_id + task_difficulty + (1 | task_id)   [logistic]
```

---

## 7. Figure Plan

| Fig | Type | X | Y | Key Question |
|----|------|---|---|-------------|
| 1 | Violin + box | Environment | total_input_tokens (log₂) | Does structure reduce token cost? |
| 2 | Bar + CI | Environment | score_automated | Does structure improve completion? |
| 3 | Empirical CDF | time_to_first_edit_seconds | Cumulative proportion | Does structure accelerate orientation? |
| 4 | Scatter + regression | nav_entropy_pre_edit | total_input_tokens (log₂) | Does entropy predict token waste? |
| 5 | Stacked bar | Environment | Phase token proportions | Does structure shift orientation→implementation? |
| 6 | Box plot | Environment | nav_entropy_pre_edit | Does AGENTS.md reduce search entropy? |
| 7 | Grouped bar | Environment | efficiency_ratio (median) | Does structure help harder tasks more? |
| 8 | Stacked bar | {E4, E5} | Memory operation counts | Do agents use memory? |
| 9 | Bar + jitter | Environment | replanning_events | Does structure reduce replanning? |
| 10 | Line (dual axis) | Environment | TC + SR by agent | Do agents respond to structure differently? |
| 11 | Line + IQR band | Message seq (normalized) | Cumulative input tokens | When does token budget diverge? |
| 12 | Heatmap | Environment | Top-20 files accessed pre-edit | What do agents look at first? |

---

## 8. Pilot Experiment Design

### 8.1 Task Suite

| ID | Title | Category | Difficulty |
|----|-------|----------|-----------|
| T01 | Add GET /health/deep endpoint | feature | easy |
| T02 | Fix bearer token validation bug | bugfix | easy |
| T03 | Add rate limiting to /api/chat | feature | medium |
| T04 | Refactor scopes.py to use dataclasses | refactor | medium |
| T05 | Write pytest suite for workspace_memory.py | test | medium |
| T06 | Add pagination to GET /api/files/list | feature | medium |
| T07 | Implement idempotent project creation | feature | hard |
| T08 | Add structured logging (structlog) | feature | hard |
| T09 | Fix N+1 query in usage sync | bugfix | hard |
| T10 | Document the full API surface in OpenAPI | documentation | easy |

### 8.2 Run Protocol

```
For each task T in [T01..T10]:
  For each environment E in [E0..E5]:
    1. setup_run.sh  → worktree + overlay + run_meta.json
    2. Invoke agent with task prompt
    3. Wait for exit or timeout
    4. teardown_run.sh  → git.patch + transcript copy + grade.json
    5. extract_telemetry.py  → run_record.json + event_log.jsonl
    6. validate_schema.py  → fail fast on malformed records
```

### 8.3 Expected Outputs After 60 Pilot Runs

| Output | Location | Format |
|--------|----------|--------|
| 60 run records | results/raw/pilot_runs.jsonl | JSONL |
| 60 transcripts | runs/*/transcript.jsonl | JSONL |
| 60 git patches | runs/*/git.patch | unified diff |
| 60 grade files | runs/*/grade.json | JSON |
| 60 event logs | runs/*/event_log.jsonl | JSONL |
| Flat dataset | results/processed/dataset.parquet | Parquet |
| 12 figures | results/processed/figures/*.pdf | PDF + PNG |

### 8.4 Expansion Notes

- **Multi-agent:** agent_id and agent_provider are first-class fields. New agents require only a transcript adapter.
- **RL reward signal:** efficiency_ratio is a natural reward. token_curve provides partial-episode shaping.
- **New repositories:** task YAMLs are repository-scoped. New repos require only new task files and updated env overlays.
