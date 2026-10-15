#!/usr/bin/env bash
# bootstrap.sh
#
# Responsibility: One-time, idempotent setup that makes the experiment
#                 HERMETIC — it lives entirely inside experiments/ and never
#                 reads from or writes to an external xo-cowork-api working copy
#                 at run time.
#
# It produces two things:
#   1. target/xo-cowork-api.git  — a self-contained bare clone of the target repo
#                                  (source of every run's worktree). Cloned ONCE
#                                  from the source repo (read-only); after that the
#                                  source repo is never touched again.
#   2. .venv/                     — an isolated Python venv with the target app's
#                                  runtime deps + pytest, used by the grader to run
#                                  acceptance criteria. Built from the bare repo's
#                                  own requirements.txt, NOT from any external venv.
#
# Why this exists: a prior run of the experiment leaked task work into a shared
# xo-cowork-api checkout because setup_run.sh symlinked (and could `install` into)
# ../xo-cowork-api. This script removes that dependency. setup_run.sh now consumes
# only target/xo-cowork-api.git and .venv, both inside experiments/.
#
# Safe to re-run. Pass --rebuild-venv to recreate the venv from scratch.
#
# Usage:
#   bash harness/scripts/bootstrap.sh
#   bash harness/scripts/bootstrap.sh --rebuild-venv

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENTS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

BASE_SHA="4e09644cab6f2ac4a2b91573fb670a0546f69cd4"
BARE_REPO="$EXPERIMENTS_DIR/target/xo-cowork-api.git"
SOURCE_REPO="$EXPERIMENTS_DIR/../xo-cowork-api"   # only used ONCE, read-only, to seed the bare clone
TARGET_REPO_URL="${TARGET_REPO_URL:-https://github.com/dwivedi-ai/xo-cowork-api.git}"
EXP_VENV="$EXPERIMENTS_DIR/.venv"

REBUILD_VENV=0
[[ "${1:-}" == "--rebuild-venv" ]] && REBUILD_VENV=1

echo "================================================================"
echo " Bootstrap (hermetic experiment setup)"
echo " experiments dir: $EXPERIMENTS_DIR"
echo "================================================================"

# ── 1. Bare repo (self-contained source of all worktrees) ────────────────────
if [[ -d "$BARE_REPO" ]]; then
  echo "[ok]   bare repo already present: target/xo-cowork-api.git"
else
  echo "[..]   bare repo missing — creating one-time clone"
  if [[ -d "$SOURCE_REPO/.git" ]]; then
    echo "[..]   cloning bare from local source: $SOURCE_REPO"
    git clone --bare "$SOURCE_REPO" "$BARE_REPO"
  else
    echo "[..]   no local source repo; cloning bare from $TARGET_REPO_URL"
    git clone --bare "$TARGET_REPO_URL" "$BARE_REPO" || {
      echo "ERROR: could not obtain the target repo." >&2
      echo "       Ship target/xo-cowork-api.git inside the tarball, place the" >&2
      echo "       source at ../xo-cowork-api, or set TARGET_REPO_URL to a repo" >&2
      echo "       you can clone (must contain SHA $BASE_SHA)." >&2
      exit 1
    }
  fi
  # Drop alternates so the bare repo is fully self-contained (tarball-portable).
  rm -f "$BARE_REPO/objects/info/alternates"
  echo "[ok]   bare repo created and de-aliased"
fi

# Verify the pinned SHA actually exists in the bare repo.
if ! git --git-dir="$BARE_REPO" cat-file -t "$BASE_SHA" >/dev/null 2>&1; then
  echo "ERROR: pinned BASE_SHA $BASE_SHA not found in bare repo" >&2
  exit 1
fi
echo "[ok]   pinned SHA present: $BASE_SHA"

# ── 2. Hermetic venv (target runtime deps + pytest) ──────────────────────────
if [[ "$REBUILD_VENV" == "1" && -d "$EXP_VENV" ]]; then
  echo "[..]   --rebuild-venv: removing existing .venv"
  rm -rf "$EXP_VENV"
fi

if [[ -x "$EXP_VENV/bin/pytest" ]]; then
  echo "[ok]   .venv already present with pytest"
else
  echo "[..]   building hermetic .venv"
  # Pull requirements.txt straight out of the pinned bare repo — never from an
  # external working copy — so the venv matches the exact code under test.
  REQ_TMP="$(mktemp)"
  if git --git-dir="$BARE_REPO" show "$BASE_SHA:requirements.txt" > "$REQ_TMP" 2>/dev/null; then
    echo "[ok]   extracted requirements.txt from pinned SHA"
  else
    echo "WARN: no requirements.txt at pinned SHA; installing pytest only" >&2
    : > "$REQ_TMP"
  fi
  python3 -m venv "$EXP_VENV"
  "$EXP_VENV/bin/pip" install -q --upgrade pip
  "$EXP_VENV/bin/pip" install -q -r "$REQ_TMP" pytest
  rm -f "$REQ_TMP"
  echo "[ok]   .venv built: $("$EXP_VENV/bin/python" --version), $("$EXP_VENV/bin/pytest" --version 2>&1 | head -1)"
fi

echo ""
echo "Bootstrap complete. The experiment is now self-contained:"
echo "  - source of worktrees : target/xo-cowork-api.git (self-contained)"
echo "  - grader venv         : .venv (pytest available)"
echo "No external xo-cowork-api working copy is touched at run time."
