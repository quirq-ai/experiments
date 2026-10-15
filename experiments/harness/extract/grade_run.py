#!/usr/bin/env python3
"""
grade_run.py
------------
Responsibility: Run automated acceptance criteria against the workspace
                and write grade.json.

Inputs:
  --workspace       path to agent's worktree
  --task            path to task definition YAML
  --run-id          run identifier (for output labelling)
  --agent-exit-code exit code of the agent process
  --output          path to write grade.json

Outputs:
  grade.json with schema:
  {
    "run_id": "...",
    "task_id": "T01",
    "ac_results": {
      "AC1": {"passed": true,  "output": "3 passed in 0.42s"},
      "AC2": {"passed": false, "output": "0"}
    },
    "score_automated": 0.5,   # fraction of automated ACs passed
    "score_human": null,       # filled manually later
    "terminal_state": "completed" | "partial" | "failed" | "timeout" | "error"
  }
"""

from __future__ import annotations
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import yaml


AC_TIMEOUT_DEFAULT = 60  # seconds per AC


def run_ac(ac: dict, workspace: Path) -> tuple[bool | None, str]:
    """
    Execute one automated acceptance criterion.
    Returns (passed: bool|None, output: str).
    None = could not determine (AC type not implemented).
    """
    ac_type = ac["type"]
    command = ac["command"]
    pass_condition = ac["pass_condition"]
    timeout = ac.get("timeout_seconds", AC_TIMEOUT_DEFAULT)

    if ac_type in ("shell", "pytest"):
        try:
            # Prepend workspace venv/bin to PATH so that `pytest`, `python`, etc.
            # resolve correctly without requiring the agent to activate the venv.
            venv_bin = str(workspace / "venv" / "bin")
            env = {**os.environ, "PATH": f"{venv_bin}:{os.environ.get('PATH', '')}"}
            result = subprocess.run(
                command,
                shell=True,
                cwd=str(workspace),
                capture_output=True,
                text=True,
                timeout=timeout,
                env=env,
            )
            stdout = (result.stdout + result.stderr).strip()
            exit_code = result.returncode

            # Evaluate pass_condition
            # Supported: "exit_code == 0", "int(stdout.strip()) >= N", "len(stdout) > 0"
            local_ns = {
                "exit_code": exit_code, "stdout": stdout,
                "int": int, "str": str, "float": float, "len": len, "bool": bool,
            }
            try:
                passed = bool(eval(pass_condition, {"__builtins__": {}}, local_ns))
            except Exception as e:
                passed = exit_code == 0  # fallback
                stdout += f"\n[eval error: {e}]"

            return passed, stdout[:500]

        except subprocess.TimeoutExpired:
            return False, f"[timeout after {timeout}s]"
        except Exception as e:
            return False, f"[error: {e}]"

    elif ac_type == "regex":
        try:
            result = subprocess.run(
                command, shell=True, cwd=str(workspace),
                capture_output=True, text=True, timeout=timeout,
            )
            output = result.stdout + result.stderr
            pattern = pass_condition
            passed = bool(re.search(pattern, output))
            return passed, output[:200]
        except Exception as e:
            return False, str(e)

    elif ac_type == "ast_check":
        # ast_check: run command, expect JSON output with {"passed": true/false}
        try:
            result = subprocess.run(
                command, shell=True, cwd=str(workspace),
                capture_output=True, text=True, timeout=timeout,
            )
            data = json.loads(result.stdout)
            return bool(data.get("passed")), data.get("message", "")
        except Exception as e:
            return None, f"[ast_check error: {e}]"

    return None, f"[unsupported AC type: {ac_type}]"


def determine_terminal_state(
    agent_exit_code: int,
    score: float | None,
    ac_results: dict,
) -> str:
    if agent_exit_code == 124:
        return "timeout"
    if agent_exit_code not in (0, 1):
        return "error"
    if score is None:
        return "error"
    if score == 1.0:
        return "completed"
    if score == 0.0:
        return "failed"
    return "partial"


def main():
    parser = argparse.ArgumentParser(description="Grade one experiment run.")
    parser.add_argument("--workspace",        required=True)
    parser.add_argument("--task",             required=True)
    parser.add_argument("--run-id",           required=True)
    parser.add_argument("--agent-exit-code",  type=int, default=0)
    parser.add_argument("--output",           required=True)
    args = parser.parse_args()

    workspace = Path(args.workspace)
    if not workspace.exists():
        print(f"ERROR: workspace not found: {workspace}", file=sys.stderr)
        grade = {
            "run_id": args.run_id,
            "task_id": "unknown",
            "ac_results": {},
            "score_automated": None,
            "score_human": None,
            "terminal_state": "error",
        }
        Path(args.output).write_text(json.dumps(grade, indent=2))
        sys.exit(0)

    with open(args.task) as f:
        task_def = yaml.safe_load(f)

    task_id = task_def["task_id"]
    automated_acs = task_def.get("acceptance_criteria", {}).get("automated", [])

    ac_results = {}
    passed_count = 0

    print(f"Grading {task_id} in {workspace}")
    for ac in automated_acs:
        ac_id = ac["id"]
        print(f"  {ac_id}: {ac['type']} — {ac['command'][:60]}...")
        passed, output = run_ac(ac, workspace)
        ac_results[ac_id] = {"passed": passed, "output": output}
        if passed is True:
            passed_count += 1
        status = "PASS" if passed else ("SKIP" if passed is None else "FAIL")
        print(f"    [{status}] {output[:100]}")

    total = len(automated_acs)
    score = passed_count / total if total > 0 else None

    terminal_state = determine_terminal_state(
        args.agent_exit_code, score, ac_results
    )

    grade = {
        "run_id": args.run_id,
        "task_id": task_id,
        "ac_results": ac_results,
        "score_automated": score,
        "score_human": None,
        "terminal_state": terminal_state,
    }

    Path(args.output).write_text(json.dumps(grade, indent=2))
    print(f"grade → {args.output}  score={score}  state={terminal_state}")


if __name__ == "__main__":
    main()
