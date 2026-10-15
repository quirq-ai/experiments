#!/usr/bin/env bash
# run.sh — friendly entry point for the Structured Agent Environments experiment.
#
# This is the script collaborators use. It exposes plain flags over the harness
# (which is driven by env vars under the hood) and bootstraps prerequisites on
# first use. Give it a task and it runs that task across all 6 environments;
# narrow with --env to compare specific conditions (e.g. E0 vs E5).
#
# Recommended: go ONE TASK AT A TIME so results stream in. A task's 6 envs are
# fully isolated, so --parallel runs them at once and a complete env-row lands
# before you start the next task (codex only — see note below).
#
# Examples
#   ./run.sh --task T01 --tag alice                  # T01 on all 6 envs (serial)
#   ./run.sh --task T01 --parallel --tag alice        # T01's 6 envs at once → real-time row
#   ./run.sh --task T01 --env E0,E5 --tag alice        # just E0 vs E5 (bare vs full-XO)
#   ./run.sh --task T01,T02,T03 --tag bob              # several tasks, all envs
#   ./run.sh --task all --parallel --tag carol         # whole matrix, a task-row at a time
#   ./run.sh --task T04 --env E3 --tag alice -n        # dry run (print, don't execute)
#   ./run.sh --list                                    # show tasks / envs / agents
#
# Flags
#   -t, --task   <ids|all>   Task id(s): T01 ... T10, comma-separated, or "all" (default: all)
#   -e, --env    <ids|all>   Env id(s):  E0 ... E5, comma-separated, or "all" (default: all)
#   -a, --agent  <name>      Agent: codex | claude (or a full id). Default: codex
#       --tag    <name>      Operator tag — distinguishes your runs from other people's so
#                            results merge cleanly. Defaults to the hostname with a warning.
#   -p, --parallel           Run a task's selected envs concurrently (codex only; isolated
#                            worktrees). Tasks still run one at a time. Ignored for claude.
#       --rep    <n>         Replication number (default: 1). Use 2,3,... for repeats.
#       --max-seconds <n>    Per-run timeout in seconds; 0 = no timeout (default).
#                            A timeout SIGKILLs the agent mid-run → 0-token record, so
#                            no-timeout is preferred; set a value only as a runaway guard.
#       --exp    <name>      Experiment id / run-id prefix (default: pilot).
#   -n, --dry-run            Print what would run without invoking the agent.
#   -l, --list               List available tasks, environments, and agents, then exit.
#   -h, --help               Show this help.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

ALL_TASKS=(T01 T02 T03 T04 T05 T06 T07 T08 T09 T10)
ALL_ENVS=(E0 E1 E2 E3 E4 E5)

# Defaults
TASKS=""; ENVS=""; AGENT="codex"; TAG=""
REP=1; MAXS=0; EXP="pilot"; DRY=0; PAR=0   # MAXS=0 → no timeout (agent runs to completion)

usage() { sed -n '2,45p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

c_warn() { printf '\033[33m%s\033[0m\n' "$*" >&2; }
c_err()  { printf '\033[31m%s\033[0m\n' "$*" >&2; }

list_all() {
  echo "Tasks:"
  for t in "${ALL_TASKS[@]}"; do
    title=$(python3 -c "import yaml;print(yaml.safe_load(open('harness/tasks/$t.yaml')).get('title',''))" 2>/dev/null || echo "")
    diff=$(python3 -c "import yaml;print(yaml.safe_load(open('harness/tasks/$t.yaml')).get('difficulty',''))" 2>/dev/null || echo "")
    printf "  %-4s [%-6s] %s\n" "$t" "$diff" "$title"
  done
  echo ""
  echo "Environments:"
  echo "  E0  Empty workspace (bare repo, no context)"
  echo "  E1  + README.md"
  echo "  E2  + AGENTS.md"
  echo "  E3  + AGENTS.md + PROJECT.md"
  echo "  E4  + full XO scaffold (empty memory)"
  echo "  E5  + full XO scaffold + seeded memory"
  echo ""
  echo "Agents:"
  echo "  codex    -> codex             (default; reports tokens+cache, no timing; --parallel ok)"
  echo "  claude   -> claude-sonnet-4-6 (reports timing/TTFUA; runs envs serially)"
}

# ── Parse args ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--task)        TASKS="${2:?}"; shift 2;;
    -e|--env)         ENVS="${2:?}"; shift 2;;
    -a|--agent)       AGENT="${2:?}"; shift 2;;
    --tag)            TAG="${2:?}"; shift 2;;
    --rep)            REP="${2:?}"; shift 2;;
    --max-seconds)    MAXS="${2:?}"; shift 2;;
    --exp)            EXP="${2:?}"; shift 2;;
    -p|--parallel)    PAR=1; shift;;
    -n|--dry-run)     DRY=1; shift;;
    -l|--list)        list_all; exit 0;;
    -h|--help)        usage; exit 0;;
    *) c_err "unknown argument: $1"; echo; usage; exit 1;;
  esac
done

# ── Resolve agent alias ──────────────────────────────────────────────────────
case "$AGENT" in
  claude|sonnet|claude-sonnet) AGENT="claude-sonnet-4-6";;
  codex|openai)                AGENT="codex";;
esac

# ── Normalize "all" → empty filter (harness treats empty as all) ─────────────
[[ "$TASKS" == "all" ]] && TASKS=""
[[ "$ENVS"  == "all" ]] && ENVS=""

# ── Validate task / env ids ──────────────────────────────────────────────────
contains() { local x="$1"; shift; for e in "$@"; do [[ "$e" == "$x" ]] && return 0; done; return 1; }
validate_ids() {
  local kind="$1" csv="$2"; shift 2; local valid=("$@")
  [[ -z "$csv" ]] && return 0
  local IFS=','; for id in $csv; do
    if ! contains "$id" "${valid[@]}"; then
      c_err "invalid $kind id: '$id' (valid: ${valid[*]})"; exit 1
    fi
  done
}
validate_ids task "$TASKS" "${ALL_TASKS[@]}"
validate_ids env  "$ENVS"  "${ALL_ENVS[@]}"

# ── Operator tag: default to hostname, warn so merges stay collision-free ─────
if [[ -z "$TAG" ]]; then
  TAG="$(hostname -s 2>/dev/null || hostname 2>/dev/null || echo operator)"
  c_warn "WARNING: no --tag given; defaulting operator tag to '$TAG'."
  c_warn "         For clean cross-person merges, pass an explicit --tag <yourname>."
fi

# ── Bootstrap prerequisites on first use ─────────────────────────────────────
if [[ ! -d target/xo-cowork-api.git || ! -x .venv/bin/python ]]; then
  echo "First run detected — bootstrapping (self-contained bare repo + venv)..."
  bash harness/scripts/bootstrap.sh
fi

# ── Launch ───────────────────────────────────────────────────────────────────
echo "Launching: agent=$AGENT  tasks=${TASKS:-all}  envs=${ENVS:-all}  tag=$TAG  rep=$REP  exp=$EXP  parallel=$PAR  dry=$DRY"
AGENT_ID="$AGENT" \
RUN_TAG="$TAG" \
EXPERIMENT_ID="$EXP" \
REPLICATION="$REP" \
MAX_SECONDS="$MAXS" \
TASK_FILTER="$TASKS" \
ENV_FILTER="$ENVS" \
DRY_RUN="$DRY" \
PARALLEL_ENVS="$PAR" \
  bash harness/scripts/run_experiment.sh
