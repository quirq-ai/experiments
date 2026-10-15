#!/usr/bin/env bash
# teardown_run.sh
#
# Responsibility: Collect all artifacts after agent exits, run grader,
#                 invoke telemetry extractor, validate schema, then
#                 remove the worktree. Leaves runs/{RUN_ID}/ fully populated.
#
# Inputs (environment variables):
#   RUN_ID            — e.g. pilot-T01-E3-claude-sonnet-4-6-001
#   AGENT_EXIT_CODE   — exit code from the agent process (default 0)
#   TERMINAL_STATE    — override terminal_state (optional; extractor infers if absent)
#
# Outputs:
#   runs/{RUN_ID}/git.patch          — unified diff of all changes
#   runs/{RUN_ID}/transcript.jsonl   — copied from agent's session dir
#   runs/{RUN_ID}/grade.json         — acceptance criteria results
#   runs/{RUN_ID}/run_record.json    — canonical telemetry record
#   runs/{RUN_ID}/event_log.jsonl    — per-event log
#
# Usage (called by run_experiment.sh after agent exits):
#   RUN_ID=pilot-T01-E3-... AGENT_EXIT_CODE=0 ./harness/scripts/teardown_run.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENTS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

: "${RUN_ID:?RUN_ID is required}"
: "${AGENT_EXIT_CODE:=0}"

RUN_DIR="$EXPERIMENTS_DIR/runs/$RUN_ID"
WORKSPACE="$RUN_DIR/workspace"
META_FILE="$RUN_DIR/run_meta.json"
PYTHON="${PYTHON:-python3}"

if [[ ! -f "$META_FILE" ]]; then
  echo "ERROR: run_meta.json not found for $RUN_ID" >&2; exit 1
fi

# Read metadata
TASK_ID=$(python3 -c "import json; d=json.load(open('$META_FILE')); print(d['task_id'])")
AGENT_ID=$(python3 -c "import json; d=json.load(open('$META_FILE')); print(d['agent_id'])")
BARE_REPO="$EXPERIMENTS_DIR/target/xo-cowork-api.git"

echo "==> Tearing down run: $RUN_ID"

# ── 1. Capture git diff ──────────────────────────────────────────────────────
echo "--> Capturing git patch"
(
  cd "$WORKSPACE"
  git diff HEAD > "$RUN_DIR/git.patch" 2>/dev/null || true
  # Also capture untracked files (new files created by agent)
  git ls-files --others --exclude-standard | \
    xargs -I{} git diff --no-index /dev/null {} >> "$RUN_DIR/git.patch" 2>/dev/null || true
)

# ── 2. Copy / verify agent transcript ───────────────────────────────────────
echo "--> Locating agent transcript"
if [[ "$AGENT_ID" == claude-* ]]; then
  # Claude Code writes sessions to ~/.claude/projects/{base64(workspace_path)}/
  # The path hash uses base64 encoding of the absolute workspace path.
  WORKSPACE_HASH=$(python3 -c "
import base64
path = '$WORKSPACE'
encoded = base64.b64encode(path.encode()).decode().rstrip('=')
print(encoded)
")
  TRANSCRIPT_DIR="$HOME/.claude/projects/$WORKSPACE_HASH"
  if [[ -d "$TRANSCRIPT_DIR" ]]; then
    LATEST=$(ls -t "$TRANSCRIPT_DIR"/*.jsonl 2>/dev/null | head -1)
    if [[ -n "$LATEST" ]]; then
      cp "$LATEST" "$RUN_DIR/transcript.jsonl"
      echo "--> Transcript: $LATEST"
    else
      echo "WARN: no transcript JSONL found in $TRANSCRIPT_DIR" >&2
      echo '{"type":"error","message":"no transcript found"}' > "$RUN_DIR/transcript.jsonl"
    fi
  else
    echo "WARN: transcript dir not found: $TRANSCRIPT_DIR" >&2
    echo '{"type":"error","message":"transcript dir not found"}' > "$RUN_DIR/transcript.jsonl"
  fi

elif [[ "$AGENT_ID" == "codex" ]]; then
  # Codex: run_experiment.sh captured stdout (--json) directly to transcript.jsonl.
  # Nothing to copy — just verify the file exists and has content.
  if [[ ! -f "$RUN_DIR/transcript.jsonl" ]] || [[ ! -s "$RUN_DIR/transcript.jsonl" ]]; then
    echo "WARN: Codex transcript.jsonl missing or empty" >&2
    echo '{"type":"error","message":"codex produced no output"}' > "$RUN_DIR/transcript.jsonl"
  else
    LINE_COUNT=$(wc -l < "$RUN_DIR/transcript.jsonl")
    echo "--> Codex transcript: $LINE_COUNT events"
  fi
fi

# ── 3. Run grader ────────────────────────────────────────────────────────────
echo "--> Running grader"
TASK_FILE="$EXPERIMENTS_DIR/harness/tasks/${TASK_ID}.yaml"
$PYTHON "$EXPERIMENTS_DIR/harness/extract/grade_run.py" \
  --workspace "$WORKSPACE" \
  --task "$TASK_FILE" \
  --run-id "$RUN_ID" \
  --agent-exit-code "$AGENT_EXIT_CODE" \
  --output "$RUN_DIR/grade.json" || {
    echo "WARN: grader failed; writing error grade" >&2
    echo '{"run_id":"'"$RUN_ID"'","terminal_state":"error","score_automated":null,"ac_results":{}}' \
      > "$RUN_DIR/grade.json"
  }

# ── 4. Extract telemetry ─────────────────────────────────────────────────────
echo "--> Extracting telemetry"
TIMESTAMP_END=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Patch timestamp_end into run_meta
python3 -c "
import json
with open('$META_FILE') as f: meta = json.load(f)
meta['timestamp_end'] = '$TIMESTAMP_END'
with open('$META_FILE', 'w') as f: json.dump(meta, f, indent=2)
"

$PYTHON "$EXPERIMENTS_DIR/harness/extract/extract_telemetry.py" \
  --transcript "$RUN_DIR/transcript.jsonl" \
  --task-file "$TASK_FILE" \
  --run-meta "$RUN_DIR/run_meta.json" \
  --grade "$RUN_DIR/grade.json" \
  --output "$RUN_DIR/run_record.json" \
  --event-log "$RUN_DIR/event_log.jsonl"

# ── 5. Validate schema ───────────────────────────────────────────────────────
echo "--> Validating schema"
$PYTHON "$EXPERIMENTS_DIR/harness/extract/validate_schema.py" \
  --record "$RUN_DIR/run_record.json" \
  --schema "$EXPERIMENTS_DIR/harness/schemas/run_record.schema.json" || {
    echo "ERROR: schema validation failed for $RUN_ID" >&2
    # Don't exit — log the failure and continue teardown
  }

# ── 6. Restore Claude settings ───────────────────────────────────────────────
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
CLAUDE_SETTINGS_BACKUP="$RUN_DIR/claude_settings_backup.json"
if [[ -f "$CLAUDE_SETTINGS_BACKUP" ]]; then
  cp "$CLAUDE_SETTINGS_BACKUP" "$CLAUDE_SETTINGS"
  echo "--> Restored Claude settings"
fi

# ── 7. Remove worktree ───────────────────────────────────────────────────────
echo "--> Removing worktree"
git --git-dir="$BARE_REPO" worktree remove --force "$WORKSPACE" 2>/dev/null || \
  rm -rf "$WORKSPACE"

echo "==> Teardown complete: $RUN_DIR"
