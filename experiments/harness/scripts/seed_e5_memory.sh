#!/usr/bin/env bash
# seed_e5_memory.sh
#
# Responsibility: Generate pre-seeded memory files for E5 environment.
#                 Runs a short "discovery" agent session in E4 condition,
#                 then extracts memory/ files written by the agent.
#                 Output is frozen and used as the E5 overlay for all
#                 subsequent E5 runs of the same task.
#
# Inputs:
#   TASK_ID   — task to seed for (seeds are task-specific)
#   AGENT_ID  — which agent generates the seed (should match experiment agent)
#
# Outputs:
#   harness/e5_seeds/{TASK_ID}/memory/  — seeded memory tree
#
# Usage:
#   TASK_ID=T01 AGENT_ID=claude-sonnet-4-6 ./harness/scripts/seed_e5_memory.sh
#
# Note: Run this ONCE per task before the main experiment. Seed runs are
#       NOT included in analysis. The seed is frozen after generation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENTS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

: "${TASK_ID:?TASK_ID is required}"
: "${AGENT_ID:=claude-sonnet-4-6}"

SEED_DIR="$EXPERIMENTS_DIR/harness/e5_seeds/$TASK_ID"
SEED_RUN_ID="seed-${TASK_ID}-$(date +%Y%m%d%H%M%S)"
BARE_REPO="$EXPERIMENTS_DIR/target/xo-cowork-api.git"
BASE_SHA="4e09644cab6f2ac4a2b91573fb670a0546f69cd4"
WORKSPACE="$EXPERIMENTS_DIR/runs/${SEED_RUN_ID}/workspace"
TASK_FILE="$EXPERIMENTS_DIR/harness/tasks/${TASK_ID}.yaml"
ENVS_DIR="$EXPERIMENTS_DIR/harness/envs"

if [[ -f "$SEED_DIR/memory/semantic/project-facts.md" ]] && \
   [[ -s "$SEED_DIR/memory/semantic/project-facts.md" ]]; then
  echo "Seed for $TASK_ID already exists and is non-empty. Delete to regenerate:"
  echo "  rm -rf $SEED_DIR/memory && $0"
  exit 0
fi

echo "==> Generating E5 seed for $TASK_ID using $AGENT_ID"

# Create worktree with E4 overlay
mkdir -p "$EXPERIMENTS_DIR/runs/$SEED_RUN_ID"
git --git-dir="$BARE_REPO" worktree add --detach "$WORKSPACE" "$BASE_SHA"
cp -r "$ENVS_DIR/E4"/. "$WORKSPACE/"

# Seed prompt: ask agent to explore the codebase and populate memory
SEED_PROMPT="You are exploring a codebase for the first time. Your task is to:
1. Read and understand the project structure (routers/, services/, config/, DEVELOPING.md)
2. Populate memory/semantic/project-facts.md with 6-10 key architectural facts
3. Populate memory/semantic/constraints.md with hard rules from DEVELOPING.md
4. Write one episodic entry in memory/episodic/ about your exploration
5. If you discover a reusable pattern (e.g. how to add a new router), write a procedural entry

Do NOT implement any features. Just explore and document. Follow the memory format in AGENTS.md exactly."

(
  cd "$WORKSPACE"
  if [[ "$AGENT_ID" == claude-* ]]; then
    timeout 900 claude \
      --model "$AGENT_ID" \
      --output-format json \
      --print "$SEED_PROMPT" > "$EXPERIMENTS_DIR/runs/$SEED_RUN_ID/seed_stdout.txt" 2>&1 || true
  fi
)

# Extract memory files written by the agent
echo "--> Extracting seeded memory files"
mkdir -p "$SEED_DIR/memory"
if [[ -d "$WORKSPACE/memory" ]]; then
  cp -r "$WORKSPACE/memory/." "$SEED_DIR/memory/"
  echo "--> Seed files:"
  find "$SEED_DIR/memory" -type f | sort
else
  echo "WARN: agent wrote no memory files — seed is empty" >&2
fi

# Cleanup workspace
git --git-dir="$BARE_REPO" worktree remove --force "$WORKSPACE" 2>/dev/null || \
  rm -rf "$WORKSPACE"

echo "==> Seed complete: $SEED_DIR"
