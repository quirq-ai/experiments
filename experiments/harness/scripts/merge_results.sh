#!/usr/bin/env bash
# merge_results.sh — ingest collaborators' result bundles into the canonical runs/.
#
# Each collaborator sends a `results-<name>.tgz` made with `tar czf ... runs/`.
# Because every run is stamped with an operator --tag, run_ids are globally unique,
# so merging is just: drop their run directories alongside yours. This script does
# that safely (refusing to clobber a different run that already exists) and can
# rebuild the analysis dataset afterwards.
#
# Usage:
#   bash harness/scripts/merge_results.sh results-alice.tgz results-bob.tgz
#   bash harness/scripts/merge_results.sh path/to/their/runs/        # a runs/ dir
#   bash harness/scripts/merge_results.sh --rebuild results-*.tgz    # also rebuild dataset

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENTS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEST_RUNS="$EXPERIMENTS_DIR/runs"
mkdir -p "$DEST_RUNS"

REBUILD=0
ARGS=()
for a in "$@"; do
  if [[ "$a" == "--rebuild" ]]; then REBUILD=1; else ARGS+=("$a"); fi
done
if [[ ${#ARGS[@]} -eq 0 ]]; then
  echo "usage: merge_results.sh [--rebuild] <results-*.tgz | runs-dir> ..." >&2
  exit 1
fi

ingest_runs_dir() {  # $1 = a directory containing per-run subdirs with run_record.json
  local src="$1" added=0 skipped=0 conflict=0
  while IFS= read -r rec; do
    local rundir; rundir="$(dirname "$rec")"
    local name; name="$(basename "$rundir")"
    local dst="$DEST_RUNS/$name"
    if [[ -e "$dst" ]]; then
      # Same run_id already here — only a problem if contents differ.
      if [[ -f "$dst/run_record.json" ]] && \
         cmp -s "$dst/run_record.json" "$rec"; then
        skipped=$((skipped+1))
      else
        echo "  CONFLICT: $name already exists with different content — leaving yours in place" >&2
        conflict=$((conflict+1))
      fi
      continue
    fi
    cp -r "$rundir" "$dst"
    # Never carry over an ephemeral worktree.
    rm -rf "$dst/workspace"
    added=$((added+1))
  done < <(find "$src" -type f -name run_record.json)
  echo "  added=$added  skipped(identical)=$skipped  conflicts=$conflict"
}

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

for item in "${ARGS[@]}"; do
  echo "==> $item"
  if [[ -d "$item" ]]; then
    ingest_runs_dir "$item"
  elif [[ -f "$item" && "$item" == *.tgz ]] || [[ "$item" == *.tar.gz ]]; then
    d="$TMP_ROOT/$(basename "$item").d"; mkdir -p "$d"
    tar xzf "$item" -C "$d"
    ingest_runs_dir "$d"
  else
    echo "  skipping (not a dir or .tgz): $item" >&2
  fi
done

echo ""
echo "Total runs now in runs/: $(find "$DEST_RUNS" -maxdepth 2 -name run_record.json | wc -l)"

if [[ "$REBUILD" == "1" ]]; then
  echo ""
  echo "==> Rebuilding dataset"
  python3 "$EXPERIMENTS_DIR/analysis/scripts/build_dataset.py" \
    --runs-dir "$DEST_RUNS" \
    --output "$EXPERIMENTS_DIR/results/processed/dataset.parquet"
fi
