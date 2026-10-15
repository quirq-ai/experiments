#!/usr/bin/env bash
# make_tarball.sh — package a self-contained experiment tarball for a collaborator.
#
# Produces ./experiment-<date>.tgz containing everything a collaborator needs to
# run their share of the matrix and send results back:
#   - the harness (scripts, tasks, envs, e5_seeds, schemas, extractor)
#   - the analysis pipeline
#   - target/xo-cowork-api.git  (self-contained bare repo, ~1.2M → no external repo needed)
#   - run.sh, bootstrap.sh, docs
#
# Deliberately EXCLUDED (regenerable or operator-specific, keeps the tarball ~3 MB):
#   - .venv/            (rebuilt by bootstrap.sh on the collaborator's machine)
#   - runs/             (each collaborator generates their own; avoids run_id confusion)
#   - results/          (your data; collaborators send theirs back, you merge)
#   - __pycache__, *.pyc
#
# Usage:  bash harness/scripts/make_tarball.sh  [output_dir]

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENTS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="${1:-$EXPERIMENTS_DIR}"
STAMP="$(date -u +%Y%m%d)"
TARBALL="$OUT_DIR/experiment-$STAMP.tgz"

cd "$EXPERIMENTS_DIR"

# Refuse to ship without a self-contained bare repo (collaborators rely on it).
if [[ ! -d target/xo-cowork-api.git ]]; then
  echo "ERROR: target/xo-cowork-api.git missing — run bootstrap.sh first." >&2
  exit 1
fi
if [[ -f target/xo-cowork-api.git/objects/info/alternates ]]; then
  echo "ERROR: bare repo has alternates (not self-contained). Re-run bootstrap.sh." >&2
  exit 1
fi

# Pack from the parent so paths are prefixed with experiments/.
PARENT="$(dirname "$EXPERIMENTS_DIR")"
BASE="$(basename "$EXPERIMENTS_DIR")"

tar -C "$PARENT" \
  --exclude="$BASE/.venv" \
  --exclude="$BASE/runs" \
  --exclude="$BASE/results" \
  --exclude='*/__pycache__' \
  --exclude='*.pyc' \
  --exclude="$BASE/experiment-*.tgz" \
  -czf "$TARBALL" "$BASE"

echo "Wrote $TARBALL"
echo "  size: $(du -h "$TARBALL" | cut -f1)"
echo ""
echo "Collaborator steps after they untar:"
echo "  cd $BASE"
echo "  bash harness/scripts/bootstrap.sh        # builds .venv from the bundled bare repo"
echo "  ./run.sh --task T01 --tag <theirname>    # run + tag their work"
echo "  tar czf results-<theirname>.tgz runs/    # send this back"
