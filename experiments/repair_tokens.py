#!/usr/bin/env python3
"""
repair_tokens.py - non-invasive telemetry repair for claude runs.

The shipped teardown_run.sh looks for Claude's session transcript under a
base64-encoded workspace path, but current Claude Code stores sessions under a
dash-sanitized path (/ -> -). So teardown never finds the transcript and every
run_record reports total_input=0. This script does NOT edit the harness: it
locates the real transcript for each run and re-runs the harness's OWN extractor
(harness/extract/extract_telemetry.py) to regenerate run_record.json with correct
tokens/timing.

Run from the experiments/ dir:  python3 repair_tokens.py
"""
import glob, json, os, shutil, subprocess, sys

HOME = os.path.expanduser("~")
EXP = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(HOME, ".claude", "projects")


def is_good(rec):
    try:
        return int((rec.get("tokens") or {}).get("total_input", 0) or 0) > 0
    except Exception:
        return False


def find_transcript(ws_path):
    """Locate the Claude session jsonl for a given workspace path."""
    # Primary: dash-sanitized project dir (current Claude Code scheme).
    cand = os.path.join(PROJ, ws_path.replace("/", "-"))
    files = glob.glob(os.path.join(cand, "*.jsonl")) if os.path.isdir(cand) else []
    # Fallback: scan every project dir for a session whose cwd matches the workspace.
    if not files:
        for f in glob.glob(os.path.join(PROJ, "*", "*.jsonl")):
            try:
                with open(f, encoding="utf-8", errors="replace") as fh:
                    for line in fh:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            o = json.loads(line)
                        except Exception:
                            continue
                        if o.get("cwd") == ws_path:
                            files.append(f)
                            break
            except Exception:
                pass
    if not files:
        return None
    return max(files, key=os.path.getmtime)


def py_bin():
    v = os.path.join(EXP, ".venv", "bin", "python")
    return v if os.path.exists(v) else sys.executable


def main():
    repaired = still_zero = healthy = no_transcript = 0
    for meta_p in sorted(glob.glob(os.path.join(EXP, "runs", "*", "run_meta.json"))):
        rdir = os.path.dirname(meta_p)
        rec_p = os.path.join(rdir, "run_record.json")
        rec = None
        if os.path.exists(rec_p):
            try:
                rec = json.load(open(rec_p))
            except Exception:
                rec = None
        if rec and is_good(rec):
            healthy += 1
            continue
        try:
            meta = json.load(open(meta_p))
        except Exception:
            continue
        ws = meta.get("workspace_path", "")
        tr = find_transcript(ws)
        if not tr:
            no_transcript += 1
            print(f"NO_TRANSCRIPT  {os.path.basename(rdir)}")
            continue
        shutil.copy(tr, os.path.join(rdir, "transcript.jsonl"))
        task_file = os.path.join(EXP, "harness", "tasks", meta["task_id"] + ".yaml")
        grade = os.path.join(rdir, "grade.json")
        cmd = [py_bin(), os.path.join(EXP, "harness", "extract", "extract_telemetry.py"),
               "--transcript", os.path.join(rdir, "transcript.jsonl"),
               "--task-file", task_file,
               "--run-meta", meta_p,
               "--grade", grade,
               "--output", rec_p,
               "--event-log", os.path.join(rdir, "event_log.jsonl")]
        subprocess.run(cmd, capture_output=True, text=True)
        ti = 0
        if os.path.exists(rec_p):
            try:
                ti = int((json.load(open(rec_p)).get("tokens") or {}).get("total_input", 0) or 0)
            except Exception:
                ti = 0
        if ti > 0:
            repaired += 1
            print(f"REPAIRED       {os.path.basename(rdir)}  tok_in={ti}")
        else:
            still_zero += 1
            print(f"STILL_ZERO     {os.path.basename(rdir)}")
    print(f"[repair] healthy={healthy} repaired={repaired} still_zero={still_zero} no_transcript={no_transcript}")


if __name__ == "__main__":
    main()
