#!/usr/bin/env bash
# setup_run.sh
#
# Responsibility: Prepare one isolated run: create worktree from pinned SHA,
#                 apply environment overlay, install logging hooks, write run_meta.json.
#                 Every run sees the same source snapshot — only the overlay differs.
#
# Inputs (environment variables):
#   TASK_ID      — e.g. T01
#   ENV_ID       — e.g. E3
#   AGENT_ID     — e.g. claude-sonnet-4-6
#   RUN_ID       — e.g. pilot-T01-E3-claude-sonnet-4-6-001
#   REPLICATION  — integer (default 1)
#   EXPERIMENT_ID— e.g. pilot
#
# Outputs:
#   runs/{RUN_ID}/workspace/        — git worktree with overlay applied
#   runs/{RUN_ID}/run_meta.json     — identity record written before agent starts
#   ~/.claude/settings.json         — hooks injected (backed up first)
#
# Usage (called by run_experiment.sh):
#   TASK_ID=T01 ENV_ID=E3 AGENT_ID=claude-sonnet-4-6 RUN_ID=pilot-T01-E3-... \
#     ./harness/scripts/setup_run.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENTS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

: "${TASK_ID:?TASK_ID is required}"
: "${ENV_ID:?ENV_ID is required}"
: "${AGENT_ID:?AGENT_ID is required}"
: "${RUN_ID:?RUN_ID is required}"
: "${REPLICATION:=1}"
: "${EXPERIMENT_ID:=pilot}"
: "${RUN_TAG:=}"

BASE_SHA="4e09644cab6f2ac4a2b91573fb670a0546f69cd4"
BARE_REPO="$EXPERIMENTS_DIR/target/xo-cowork-api.git"
RUN_DIR="$EXPERIMENTS_DIR/runs/$RUN_ID"
WORKSPACE="$RUN_DIR/workspace"
ENVS_DIR="$EXPERIMENTS_DIR/harness/envs"
TASK_FILE="$EXPERIMENTS_DIR/harness/tasks/${TASK_ID}.yaml"
HOOKS_SCRIPT="$EXPERIMENTS_DIR/harness/scripts/hooks/log_tool_event.sh"

# ── Validate inputs ──────────────────────────────────────────────────────────
if [[ ! -f "$TASK_FILE" ]]; then
  echo "ERROR: task file not found: $TASK_FILE" >&2; exit 1
fi
if [[ ! -d "$ENVS_DIR/$ENV_ID" ]]; then
  echo "ERROR: env overlay not found: $ENVS_DIR/$ENV_ID" >&2; exit 1
fi
if [[ ! -d "$BARE_REPO" ]]; then
  echo "ERROR: bare repo not found: $BARE_REPO" >&2
  echo "       Run once:  bash harness/scripts/bootstrap.sh" >&2
  exit 1
fi

# ── Create run directory ─────────────────────────────────────────────────────
mkdir -p "$RUN_DIR"
echo "==> Setting up run: $RUN_ID"

# ── Create isolated worktree from pinned SHA ─────────────────────────────────
# All environments use the same SHA — only overlay differs
echo "--> Creating worktree from $BASE_SHA"
git --git-dir="$BARE_REPO" worktree add --detach "$WORKSPACE" "$BASE_SHA"

# ── Strip controlled doc files from the base snapshot ───────────────────────
# The pinned SHA has README.md, AGENTS.md, CLAUDE.md, DEVELOPING.md in the
# root, and .agents/skills/ with project-specific agent skills. These must be
# removed so that only the environment overlay determines what context the
# agent sees — otherwise every env (including E0) would have them.
echo "--> Stripping base-repo doc and skill files"
for f in README.md AGENTS.md CLAUDE.md DEVELOPING.md; do
  rm -f "$WORKSPACE/$f"
done
# .agents/skills/ and .claude/skills/ hold project-specific agent skills
# that are not experimental variables — strip both so every env is clean.
rm -rf "$WORKSPACE/.agents"
rm -rf "$WORKSPACE/.claude"

# ── Apply environment overlay ────────────────────────────────────────────────
echo "--> Applying env overlay: $ENV_ID"

OVERLAY_DIR="$ENVS_DIR/$ENV_ID"
# E5 merges base overlay then seeds (seeds override base memory)
if [[ "$ENV_ID" == "E5" ]]; then
  SEED_DIR="$EXPERIMENTS_DIR/harness/e5_seeds/$TASK_ID"
fi

# Copy overlay files (skip .gitkeep)
if [[ $(find "$OVERLAY_DIR" -not -name '.gitkeep' -type f | wc -l) -gt 0 ]]; then
  cp -r "$OVERLAY_DIR"/. "$WORKSPACE/"
fi

# For E5, merge seed memory on top of skeleton
if [[ "$ENV_ID" == "E5" && -d "${SEED_DIR:-}" ]]; then
  echo "--> Merging E5 seed memory from: $SEED_DIR"
  cp -r "$SEED_DIR/memory"/. "$WORKSPACE/memory/"
fi

# Compute overlay content hash for reproducibility
ENV_OVERLAY_HASH=$(find "$OVERLAY_DIR" -type f | sort | xargs sha256sum 2>/dev/null | sha256sum | awk '{print "sha256:"$1}')

# ── Symlink hermetic experiment venv into workspace ─────────────────────────
# The grader runs acceptance criteria with workspace/venv/bin on PATH. We point
# at the experiment-local .venv (built once by harness/scripts/bootstrap.sh from
# the pinned repo's requirements.txt + pytest) so that NO external xo-cowork-api
# working copy is ever read from or written to at run time. This is what keeps
# the experiment contained to experiments/ and prevents task work from leaking
# into a shared checkout.
EXP_VENV="$EXPERIMENTS_DIR/.venv"

if [[ ! -x "$EXP_VENV/bin/python" ]]; then
  echo "ERROR: hermetic venv missing at $EXP_VENV" >&2
  echo "       Run once:  bash harness/scripts/bootstrap.sh" >&2
  exit 1
fi
ln -sf "$EXP_VENV" "$WORKSPACE/venv"
echo "--> Symlinked hermetic venv: $EXP_VENV → $WORKSPACE/venv"

# ── Install logging hooks (Claude Code) ─────────────────────────────────────
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
CLAUDE_SETTINGS_BACKUP="$RUN_DIR/claude_settings_backup.json"
HOOKS_SETTINGS="$EXPERIMENTS_DIR/harness/scripts/hooks/settings_template.json"

if [[ "$AGENT_ID" == claude-* ]] && [[ -f "$HOOKS_SCRIPT" ]]; then
  echo "--> Installing Claude Code logging hooks"

  # Back up existing settings
  if [[ -f "$CLAUDE_SETTINGS" ]]; then
    cp "$CLAUDE_SETTINGS" "$CLAUDE_SETTINGS_BACKUP"
  fi

  # Export env vars that the hook script reads
  export EXPERIMENT_RUN_ID="$RUN_ID"
  export EXPERIMENT_RUNS_DIR="$EXPERIMENTS_DIR/runs"

  # Merge hook config into settings (preserve existing settings)
  if command -v python3 &>/dev/null; then
    python3 - "$CLAUDE_SETTINGS" "$HOOKS_SETTINGS" "$EXPERIMENTS_DIR/harness/scripts/hooks/log_tool_event.sh" "$RUN_DIR" <<'EOF'
import json, sys, os
settings_path, hooks_template_path, hook_script, run_dir = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
existing = {}
if os.path.exists(settings_path):
    with open(settings_path) as f:
        existing = json.load(f)
with open(hooks_template_path) as f:
    hook_cfg = json.load(f)
# Substitute actual paths
hook_cfg_str = json.dumps(hook_cfg).replace("__HOOK_SCRIPT__", hook_script).replace("__RUN_DIR__", run_dir)
hook_cfg = json.loads(hook_cfg_str)
existing["hooks"] = hook_cfg["hooks"]
with open(settings_path, "w") as f:
    json.dump(existing, f, indent=2)
print("hooks installed")
EOF
  fi
fi

# ── Write run metadata ───────────────────────────────────────────────────────
TIMESTAMP_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > "$RUN_DIR/run_meta.json" << EOF
{
  "schema_version": "1",
  "run_id": "$RUN_ID",
  "experiment_id": "$EXPERIMENT_ID",
  "operator": "$RUN_TAG",
  "replication": $REPLICATION,
  "timestamp_start": "$TIMESTAMP_START",
  "task_id": "$TASK_ID",
  "env_id": "$ENV_ID",
  "agent_id": "$AGENT_ID",
  "base_repo_sha": "$BASE_SHA",
  "env_overlay_hash": "$ENV_OVERLAY_HASH",
  "workspace_path": "$WORKSPACE"
}
EOF

echo "==> Run $RUN_ID ready. Workspace: $WORKSPACE"
