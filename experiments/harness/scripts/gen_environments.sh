#!/usr/bin/env bash
# gen_environments.sh
#
# Responsibility: Build all 6 environment overlay trees under harness/envs/.
#                 Reads from the XO project_template. All envs are derived
#                 from the same template snapshot so content is identical
#                 across conditions (only structure differs).
#
# Inputs:
#   TEMPLATE_DIR  — path to xo-cowork-api/services/cowork_agent/project_template
#   TARGET_REPO   — path to xo-cowork-api source (for README context)
#   ENVS_DIR      — output dir (harness/envs/)
#   TASK_IDS      — space-separated list of task IDs (for E5 seed placeholders)
#
# Outputs:
#   harness/envs/E0/           (empty, just .gitkeep)
#   harness/envs/E1/README.md
#   harness/envs/E2/AGENTS.md
#   harness/envs/E3/{AGENTS.md,PROJECT.md}
#   harness/envs/E4/{full skeleton}
#   harness/envs/E5/{full skeleton + seed placeholder dirs}
#
# Usage:
#   ./harness/scripts/gen_environments.sh
#
# Run from experiments/ root. Reads harness/config.yaml for paths.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENTS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

TEMPLATE_DIR="${TEMPLATE_DIR:-$EXPERIMENTS_DIR/../xo-cowork-api/services/cowork_agent/project_template}"
TARGET_REPO="${TARGET_REPO:-$EXPERIMENTS_DIR/../xo-cowork-api}"
ENVS_DIR="${ENVS_DIR:-$EXPERIMENTS_DIR/harness/envs}"
TASK_IDS="${TASK_IDS:-T01 T02 T03 T04 T05 T06 T07 T08 T09 T10}"

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "ERROR: template dir not found: $TEMPLATE_DIR" >&2
  exit 1
fi

echo "==> Generating environments from template: $TEMPLATE_DIR"
echo "==> Output dir: $ENVS_DIR"

# ── E0: empty workspace ──────────────────────────────────────────────────────
echo "--> E0: empty"
mkdir -p "$ENVS_DIR/E0"
touch "$ENVS_DIR/E0/.gitkeep"

# ── E1: README only ──────────────────────────────────────────────────────────
echo "--> E1: README only"
mkdir -p "$ENVS_DIR/E1"

# Generate README from PROJECT.md — strip [TEMPLATE] markers, replace with
# contextual content about xo-cowork-api. This script keeps it simple by
# extracting headings and producing a functional README.
cat > "$ENVS_DIR/E1/README.md" << 'ENDREADME'
# xo-cowork-api

FastAPI backend that brokers chat and auth flows for AI coding agents
(Claude Code, OpenClaw, Hermes, Codex). Acts as a control plane over
multiple agent runtimes via a uniform `/api/*` surface.

## Architecture

- **Routers** (`routers/`): thin FastAPI route handlers, one subdirectory per domain
  - `cowork_agent/` — agent chat, sessions, files, usage, onboarding, config
  - `auth/` — token auth, per-agent setup flows
  - `status/` — provider and channel health
- **Services** (`services/cowork_agent/`): business logic, adapters, state
- **Adapters** (`services/cowork_agent/adapters/<name>/`): per-agent capability modules
  (auto-discovered, zero core edits to add a new agent)
- **Config** (`config/agents/<name>/`): per-agent lifecycle config

## Stack

Python 3.11, FastAPI, uvicorn, SQLite (via aiosqlite), httpx, pydantic v2.

## How to run

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
AGENT_NAME=claude_code uvicorn server:app --reload --port 5002
```

## How to test

```bash
pytest tests/ -q
```

## Key files

| File | Purpose |
|------|---------|
| `server.py` | App factory, router registration |
| `services/cowork_agent/adapters/loader.py` | Capability loader |
| `registry/adapter_registry.py` | Agent auto-discovery |
| `DEVELOPING.md` | Full engineering guide |
ENDREADME

# ── E2: AGENTS.md only ───────────────────────────────────────────────────────
echo "--> E2: AGENTS.md only"
mkdir -p "$ENVS_DIR/E2"
cp "$TEMPLATE_DIR/AGENTS.md" "$ENVS_DIR/E2/AGENTS.md"

# ── E3: AGENTS.md + PROJECT.md ───────────────────────────────────────────────
echo "--> E3: AGENTS.md + PROJECT.md"
mkdir -p "$ENVS_DIR/E3"
cp "$TEMPLATE_DIR/AGENTS.md"  "$ENVS_DIR/E3/AGENTS.md"

# Fill PROJECT.md template markers with xo-cowork-api specifics
sed \
  -e 's/\[TEMPLATE: project name.*\]/xo-cowork-api/' \
  -e 's/\[TEMPLATE: e\.g.*\]/FastAPI control plane for multi-agent AI coding sessions./' \
  -e 's/\[TEMPLATE: 2–4 sentences.*\]/Brokers chat, auth, and file operations across Claude Code, OpenClaw, Hermes, and Codex via a uniform REST API. Allows a single frontend to drive any agent runtime without knowing which one is active./' \
  -e 's/- `\[TEMPLATE: bullet what.s explicitly in scope\]`/- REST API for agent chat, sessions, files, usage, and auth\n- Per-agent adapter modules under services\/cowork_agent\/adapters\/\n- xo-project sync and backup flows/' \
  -e 's/- `\[TEMPLATE: bullet what.s explicitly out.*\]`/- Frontend\/UI code\n- Agent runtime internals (Claude Code, Codex binaries)\n- Infrastructure provisioning/' \
  -e 's/\[TEMPLATE: language.*\]/Python 3.11, FastAPI, uvicorn, pydantic v2, aiosqlite, httpx. Tests: pytest. Lint: ruff./' \
  -e 's/\[TEMPLATE: from \.xo.*\]/tools@kosh.network/' \
  -e 's/\[TEMPLATE: fill in the canonical commands\]/AGENT_NAME=claude_code uvicorn server:app --reload --port 5002\npytest tests\/ -q/' \
  "$TEMPLATE_DIR/PROJECT.md" > "$ENVS_DIR/E3/PROJECT.md"

# ── E4: Full XO skeleton (empty memory) ──────────────────────────────────────
echo "--> E4: full XO skeleton"
mkdir -p "$ENVS_DIR/E4"
cp "$TEMPLATE_DIR/AGENTS.md"     "$ENVS_DIR/E4/AGENTS.md"
cp "$TEMPLATE_DIR/CLAUDE.md"     "$ENVS_DIR/E4/CLAUDE.md"
cp "$ENVS_DIR/E3/PROJECT.md"     "$ENVS_DIR/E4/PROJECT.md"   # reuse filled version

# Fill OBJECTIVES.md
sed \
  -e 's/\[TEMPLATE.*\]/Achieve stable multi-agent session reliability/' \
  "$TEMPLATE_DIR/OBJECTIVES.md" > "$ENVS_DIR/E4/OBJECTIVES.md" 2>/dev/null || \
  cp "$TEMPLATE_DIR/OBJECTIVES.md" "$ENVS_DIR/E4/OBJECTIVES.md"

cp "$TEMPLATE_DIR/PLAN.md"     "$ENVS_DIR/E4/PLAN.md"
cp "$TEMPLATE_DIR/PROGRESS.md" "$ENVS_DIR/E4/PROGRESS.md"

# Copy memory skeleton (empty READMEs + .gitkeep in working/)
cp -r "$TEMPLATE_DIR/memory" "$ENVS_DIR/E4/memory"

# ── E5: Full XO + seed placeholder dirs ──────────────────────────────────────
echo "--> E5: full XO + seed placeholders"
mkdir -p "$ENVS_DIR/E5"
cp -r "$ENVS_DIR/E4/." "$ENVS_DIR/E5/"

# Create per-task seed directories (populated by seed_e5_memory.sh)
for TASK in $TASK_IDS; do
  mkdir -p "$EXPERIMENTS_DIR/harness/e5_seeds/$TASK/memory/semantic"
  mkdir -p "$EXPERIMENTS_DIR/harness/e5_seeds/$TASK/memory/episodic"
  mkdir -p "$EXPERIMENTS_DIR/harness/e5_seeds/$TASK/memory/procedural"
  touch "$EXPERIMENTS_DIR/harness/e5_seeds/$TASK/memory/semantic/project-facts.md"
  touch "$EXPERIMENTS_DIR/harness/e5_seeds/$TASK/memory/semantic/constraints.md"
  touch "$EXPERIMENTS_DIR/harness/e5_seeds/$TASK/memory/semantic/preferences.md"
  echo "# Seed memory for $TASK — run seed_e5_memory.sh to populate" \
    > "$EXPERIMENTS_DIR/harness/e5_seeds/$TASK/README.md"
done

echo ""
echo "==> Done. Environment overlays:"
for env in E0 E1 E2 E3 E4 E5; do
  COUNT=$(find "$ENVS_DIR/$env" -not -name '.gitkeep' -type f 2>/dev/null | wc -l | tr -d ' ')
  echo "    $env: $COUNT files"
done
