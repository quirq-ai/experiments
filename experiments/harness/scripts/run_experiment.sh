#!/usr/bin/env bash
# run_experiment.sh
#
# Responsibility: Outer loop orchestrator. Iterates over task × environment
#                 matrix, invokes the agent for each cell, calls setup and
#                 teardown. Serializes within machine; machines can split the
#                 matrix via TASK_FILTER / ENV_FILTER.
#
# Inputs:
#   EXPERIMENT_ID   — e.g. "pilot" (default: pilot)
#   AGENT_ID        — e.g. "claude-sonnet-4-6"
#   TASK_FILTER     — comma-separated task IDs to run (default: all)
#   ENV_FILTER      — comma-separated env IDs to run (default: all)
#   DRY_RUN         — if "1", print commands without executing
#   MAX_SECONDS     — per-run timeout override
#
# Outputs:
#   runs/{run_id}/  — one directory per run (via setup/teardown scripts)
#
# Usage:
#   AGENT_ID=claude-sonnet-4-6 ./harness/scripts/run_experiment.sh
#   AGENT_ID=claude-sonnet-4-6 TASK_FILTER=T01,T02 ENV_FILTER=E0,E3 \
#     ./harness/scripts/run_experiment.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENTS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

: "${EXPERIMENT_ID:=pilot}"
: "${AGENT_ID:?AGENT_ID is required (e.g. claude-sonnet-4-6)}"
: "${DRY_RUN:=0}"
: "${REPLICATION:=1}"
: "${MAX_SECONDS:=0}"   # 0 → no timeout (a SIGKILL mid-run yields a 0-token record); set a value only as a runaway guard
: "${RUN_TAG:=}"
: "${PARALLEL_ENVS:=0}"   # 1 = run a task's envs concurrently (isolated worktrees) for real-time per-task rows

# Operator tag — distinguishes runs produced by different people/machines so
# that results from several collaborators MERGE without run_id collisions.
# Sanitized to satisfy the run_id schema pattern [a-zA-Z0-9-]. Empty tag keeps
# the original (single-operator) run_id format for backward compatibility.
if [[ -n "$RUN_TAG" ]]; then
  RUN_TAG=$(printf '%s' "$RUN_TAG" | tr '[:upper:]' '[:lower:]' \
            | sed 's/[^a-z0-9-]/-/g; s/-\{2,\}/-/g; s/^-//; s/-$//')
fi
export RUN_TAG

ALL_TASKS="T01 T02 T03 T04 T05 T06 T07 T08 T09 T10"
ALL_ENVS="E0 E1 E2 E3 E4 E5"

# Apply filters
if [[ -n "${TASK_FILTER:-}" ]]; then
  TASKS=$(echo "$TASK_FILTER" | tr ',' ' ')
else
  TASKS="$ALL_TASKS"
fi

if [[ -n "${ENV_FILTER:-}" ]]; then
  ENVS=$(echo "$ENV_FILTER" | tr ',' ' ')
else
  ENVS="$ALL_ENVS"
fi

SETUP="$SCRIPT_DIR/setup_run.sh"
TEARDOWN="$SCRIPT_DIR/teardown_run.sh"
TASK_DIR="$EXPERIMENTS_DIR/harness/tasks"

# Parallel env execution is only safe for codex. Claude installs a global
# ~/.claude/settings.json hook config per run (parallel runs would race on it and
# corrupt it on restore) and concurrent load would also distort its wall-clock /
# TTFUA timing. Force serial for claude.
if [[ "$PARALLEL_ENVS" == "1" && "$AGENT_ID" == claude-* ]]; then
  echo "NOTE: --parallel ignored for $AGENT_ID (hook race + timing validity); running envs serially." >&2
  PARALLEL_ENVS=0
fi

echo "================================================================"
echo " Experiment: $EXPERIMENT_ID"
echo " Agent:      $AGENT_ID"
echo " Tasks:      $TASKS"
echo " Envs:       $ENVS"
echo " Operator:   ${RUN_TAG:-<none>}"
echo " Replication:$REPLICATION"
echo " Parallel:   $PARALLEL_ENVS (envs within a task run concurrently when 1)"
echo " DRY_RUN:    $DRY_RUN"
echo "================================================================"

# ── Per-cell worker: setup → agent → teardown → raw append ──────────────────
# Writes its outcome to $STATUS_DIR/$RUN_ID so the parent can tally even when
# cells run as background jobs. Marks "failed" pessimistically up front and
# overwrites on success, so a cell that dies mid-way is still accounted for.
STATUS_DIR="$(mktemp -d)"
trap 'rm -rf "$STATUS_DIR"' EXIT
RAW_FILE="$EXPERIMENTS_DIR/results/raw/${EXPERIMENT_ID}${RUN_TAG:+-$RUN_TAG}_runs.jsonl"

run_cell() {
  local TASK_ID="$1" ENV_ID="$2"
  local AGENT_DASH RUN_ID RUN_DIR WORKSPACE TASK_FILE TASK_PROMPT AGENT_EXIT_CODE TERMINAL_STATE
  AGENT_DASH=$(echo "$AGENT_ID" | tr '.' '-')
  if [[ -n "$RUN_TAG" ]]; then
    RUN_ID="${EXPERIMENT_ID}-${TASK_ID}-${ENV_ID}-${AGENT_DASH}-${RUN_TAG}-$(printf '%03d' "$REPLICATION")"
  else
    RUN_ID="${EXPERIMENT_ID}-${TASK_ID}-${ENV_ID}-${AGENT_DASH}-$(printf '%03d' "$REPLICATION")"
  fi
  RUN_DIR="$EXPERIMENTS_DIR/runs/$RUN_ID"

  if [[ -f "$RUN_DIR/run_record.json" ]]; then
    echo "[SKIP] $RUN_ID (run_record.json exists)"
    echo skipped > "$STATUS_DIR/$RUN_ID"; return 0
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY] Would run: TASK_ID=$TASK_ID ENV_ID=$ENV_ID AGENT_ID=$AGENT_ID RUN_ID=$RUN_ID"
    echo skipped > "$STATUS_DIR/$RUN_ID"; return 0
  fi

  echo "[RUN] $RUN_ID"
  echo failed > "$STATUS_DIR/$RUN_ID"   # pessimistic default

  # Setup — vars passed inline so concurrent cells never clobber each other's env
  if ! TASK_ID="$TASK_ID" ENV_ID="$ENV_ID" AGENT_ID="$AGENT_ID" RUN_ID="$RUN_ID" \
       REPLICATION="$REPLICATION" EXPERIMENT_ID="$EXPERIMENT_ID" RUN_TAG="$RUN_TAG" \
       bash "$SETUP"; then
    echo "ERROR: setup failed for $RUN_ID" >&2; return 1
  fi

  WORKSPACE="$RUN_DIR/workspace"
  TASK_FILE="$TASK_DIR/${TASK_ID}.yaml"
  if ! TASK_PROMPT=$(python3 -c "import yaml;print(yaml.safe_load(open('$TASK_FILE'))['prompt'].strip())"); then
    echo "ERROR: prompt extraction failed for $RUN_ID" >&2; return 1
  fi

  echo "--> Invoking $AGENT_ID in $WORKSPACE"
  AGENT_EXIT_CODE=0
  (
    cd "$WORKSPACE"
    export EXPERIMENT_RUN_ID="$RUN_ID"
    export EXPERIMENT_RUNS_DIR="$EXPERIMENTS_DIR/runs"
    if [[ "$AGENT_ID" == claude-* ]]; then
      timeout "$MAX_SECONDS" claude \
        --model "$AGENT_ID" --output-format json --print "$TASK_PROMPT" \
        >> "$RUN_DIR/agent_stdout.txt" 2>> "$RUN_DIR/agent_stderr.txt"
    elif [[ "$AGENT_ID" == "codex" ]]; then
      # codex exec --json writes JSONL events to stdout — this IS the transcript.
      # --ephemeral avoids polluting ~/.codex/sessions/. -C pins the cwd to the
      # isolated worktree so the agent cannot wander outside it.
      timeout "$MAX_SECONDS" codex exec \
        -C "$WORKSPACE" --sandbox workspace-write \
        --dangerously-bypass-approvals-and-sandbox --ephemeral --json \
        "$TASK_PROMPT" < /dev/null \
        > "$RUN_DIR/transcript.jsonl" 2>> "$RUN_DIR/agent_stderr.txt"
    else
      echo "ERROR: unknown agent: $AGENT_ID" >&2; exit 1
    fi
  ) || AGENT_EXIT_CODE=$?
  echo "--> [$RUN_ID] agent exited: code=$AGENT_EXIT_CODE"

  TERMINAL_STATE=""
  if [[ "$AGENT_EXIT_CODE" -eq 124 ]]; then TERMINAL_STATE="timeout"
  elif [[ "$AGENT_EXIT_CODE" -ne 0 ]]; then TERMINAL_STATE="error"; fi

  if AGENT_EXIT_CODE="$AGENT_EXIT_CODE" RUN_ID="$RUN_ID" TERMINAL_STATE="$TERMINAL_STATE" \
       bash "$TEARDOWN"; then
    echo completed > "$STATUS_DIR/$RUN_ID"
  else
    echo "ERROR: teardown failed for $RUN_ID" >&2   # status stays "failed"
  fi

  # Append to raw results (flock-guarded so parallel cells don't interleave bytes)
  if [[ -f "$RUN_DIR/run_record.json" ]]; then
    {
      flock 9 2>/dev/null || true
      cat "$RUN_DIR/run_record.json"
      echo ""
    } >> "$RAW_FILE" 9>>"$RAW_FILE.lock"
  fi
  return 0
}

# ── Outer loop: tasks SEQUENTIAL; a task's envs serial or (codex) parallel ──
# Sequential tasks + per-task env batch = a complete env-row lands before the
# next task starts, so results stream in real time instead of all-at-the-end.
for TASK_ID in $TASKS; do
  echo ""
  echo "########################## TASK $TASK_ID ##########################"
  if [[ "$PARALLEL_ENVS" == "1" ]]; then
    echo "(running envs concurrently in isolated worktrees: $ENVS)"
    for ENV_ID in $ENVS; do
      run_cell "$TASK_ID" "$ENV_ID" &
    done
    wait || true
  else
    for ENV_ID in $ENVS; do
      run_cell "$TASK_ID" "$ENV_ID" || true
    done
  fi
done

# ── Tally outcomes from status files ────────────────────────────────────────
COMPLETED=0; FAILED=0; SKIPPED=0
for f in "$STATUS_DIR"/*; do
  [[ -e "$f" ]] || continue
  case "$(cat "$f")" in
    completed) COMPLETED=$((COMPLETED+1));;
    skipped)   SKIPPED=$((SKIPPED+1));;
    *)         FAILED=$((FAILED+1));;
  esac
done

echo ""
echo "================================================================"
echo " Done. Completed: $COMPLETED  Failed: $FAILED  Skipped: $SKIPPED"
echo "================================================================"
