#!/usr/bin/env bash
# run-100.sh - collect N good runs of the Structured Agent Environments study
# with the claude agent. Resume-safe. Honors all hard rules.
#
#   usage:  bash run-100.sh [--runs N] [--sleep SECONDS] [--tag NAME]
#
#   --runs   <N>        number of good (non-zero-token) runs to collect (default 100)
#   --sleep  <seconds>  pause before each run to avoid rate limits (default 1)
#   --tag    <name>     operator tag stamped on every run (default suraj)
#
# Env vars RUNS / SLEEP / TAG also work and are overridden by the flags.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

TAG="${TAG:-suraj}"
TARGET="${RUNS:-100}"
SLEEP="${SLEEP:-1}"
JOBS="${JOBS:-2}"

while [ $# -gt 0 ]; do
  case "$1" in
    --runs)  TARGET="${2:?--runs needs a value}"; shift 2;;
    --sleep) SLEEP="${2:?--sleep needs a value}"; shift 2;;
    --tag)   TAG="${2:?--tag needs a value}"; shift 2;;
    -j|--jobs) JOBS="${2:?--jobs needs a value}"; shift 2;;
    -h|--help) sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "unknown argument: $1" >&2; exit 1;;
  esac
done

echo "[config] runs=${TARGET}  sleep=${SLEEP}s  tag=${TAG}  jobs=${JOBS}  agent=claude"
if [ "$JOBS" -gt 1 ]; then
  echo "[WARN] jobs>1: claude shares a global ~/.claude/settings.json hook, so the"
  echo "[WARN] TIMING metrics (TTFUA / wall-clock) will be unreliable in parallel."
  echo "[WARN] Token and score data remain valid."
fi

# --- macOS / GNU compatibility (do NOT edit the harness; just provide on PATH
#     the coreutils commands it expects). macOS ships neither timeout nor
#     sha256sum by default, which breaks the agent launch + overlay hashing. ---
mkdir -p results/raw results/processed/figures
SHIMDIR="$PWD/.localbin"
mkdir -p "$SHIMDIR"
if ! command -v timeout >/dev/null 2>&1; then
  cat > "$SHIMDIR/timeout" <<'SH'
#!/usr/bin/env bash
# Use gtimeout (brew coreutils) if present; otherwise run with no limit.
# The experiment runs with MAX_SECONDS=0 (no timeout), so passthrough is correct.
if command -v gtimeout >/dev/null 2>&1; then exec gtimeout "$@"; fi
shift            # drop the DURATION argument
exec "$@"
SH
  chmod +x "$SHIMDIR/timeout"
fi
if ! command -v sha256sum >/dev/null 2>&1; then
  cat > "$SHIMDIR/sha256sum" <<'SH'
#!/usr/bin/env bash
exec shasum -a 256 "$@"
SH
  chmod +x "$SHIMDIR/sha256sum"
fi
export PATH="$SHIMDIR:$PATH"
echo "[pre-flight] timeout -> $(command -v timeout)   sha256sum -> $(command -v sha256sum)"

echo "[pre-flight] headless auth gate"
if ! claude --print "Reply with exactly: OK" </dev/null 2>&1 | grep -q "OK"; then
  echo "AUTH FAIL: 'claude --print' did not return OK. Fix Claude Code login, then re-run."
  exit 1
fi

if [ ! -d target/xo-cowork-api.git ] || [ ! -x .venv/bin/python ]; then
  echo "[pre-flight] bootstrapping"
  bash harness/scripts/bootstrap.sh
fi

count_good() {
  python3 - <<'PY'
import glob, json
n = 0
for p in glob.glob("runs/*/run_record.json"):
    try:
        if int((json.load(open(p)).get("tokens") or {}).get("total_input", 0) or 0) > 0:
            n += 1
    except Exception:
        pass
print(n)
PY
}

clean_bad() {
  python3 - <<'PY'
import glob, json, os, shutil
for p in glob.glob("runs/*/run_record.json"):
    try:
        bad = int((json.load(open(p)).get("tokens") or {}).get("total_input", 0) or 0) == 0
    except Exception:
        bad = True
    if bad:
        shutil.rmtree(os.path.dirname(p), ignore_errors=True)
PY
}

launched=0
done_flag=0
for r in $(seq 1 20); do
  [ "$done_flag" -eq 1 ] && break
  for t in T01 T02 T03 T04 T05 T06 T07 T08 T09 T10; do
    [ "$done_flag" -eq 1 ] && break
    for e in E0 E1 E2 E3 E4 E5; do
      n="$(count_good)"
      if [ "${n:-0}" -ge "$TARGET" ]; then done_flag=1; break; fi
      echo "[${n}/${TARGET}] launch task=${t} env=${e} rep=${r} (jobs=${JOBS})"
      sleep "$SLEEP"   # throttle to avoid hitting rate limits between launches
      ./run.sh --task "$t" --env "$e" --agent claude --tag "$TAG" --rep "$r" &
      launched=$((launched + 1))
      # once a full chunk of JOBS is in flight, wait for them, then repair+clean
      if [ "$launched" -ge "$JOBS" ]; then
        wait
        launched=0
        python3 repair_tokens.py   # re-extract tokens from the real transcript
        clean_bad                  # drop any cell that still has 0 tokens (will retry)
      fi
    done
  done
done

wait                  # finish any partial chunk
python3 repair_tokens.py
clean_bad

python3 monitor.py --once
tar czf "results-${TAG}.tgz" runs/
echo "DONE ($(count_good) good runs) -> results-${TAG}.tgz"
