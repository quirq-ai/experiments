#!/usr/bin/env python3
"""
validate_schema.py
------------------
Responsibility: Validate run_record.json against run_record.schema.json.
                Exits non-zero if validation fails.

Inputs:
  --record    path to run_record.json
  --schema    path to run_record.schema.json

Outputs:
  stdout: validation report
  exit code: 0 = valid, 1 = invalid, 2 = missing dependency

Usage:
  python validate_schema.py --record runs/X/run_record.json \
                             --schema harness/schemas/run_record.schema.json
"""

import argparse
import json
import sys
from pathlib import Path


def validate(record_path: Path, schema_path: Path) -> tuple[bool, list[str]]:
    try:
        import jsonschema
    except ImportError:
        print("WARN: jsonschema not installed; skipping validation", file=sys.stderr)
        print("      pip install jsonschema", file=sys.stderr)
        sys.exit(2)

    with open(record_path) as f:
        record = json.load(f)
    with open(schema_path) as f:
        schema = json.load(f)

    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(record), key=lambda e: list(e.path))

    if not errors:
        return True, []

    messages = [f"{list(e.path)}: {e.message}" for e in errors]
    return False, messages


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--record", required=True)
    parser.add_argument("--schema", required=True)
    args = parser.parse_args()

    record_path = Path(args.record)
    schema_path = Path(args.schema)

    if not record_path.exists():
        print(f"ERROR: record not found: {record_path}", file=sys.stderr)
        sys.exit(1)
    if not schema_path.exists():
        print(f"ERROR: schema not found: {schema_path}", file=sys.stderr)
        sys.exit(1)

    valid, errors = validate(record_path, schema_path)

    if valid:
        print(f"OK  {record_path.name}")
        sys.exit(0)
    else:
        print(f"INVALID  {record_path.name}")
        for msg in errors:
            print(f"  - {msg}")
        sys.exit(1)


if __name__ == "__main__":
    main()
