#!/usr/bin/env python3
"""
Import a JSON file exported from the browser extension into evidence.json
(or merge with existing records). Screenshots (base64) are kept if present.

Usage:
  python scripts/import_extension_export.py path/to/test-evidence-YYYY-MM-DD.json
  python scripts/import_extension_export.py export.json --merge
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from evidence_recorder import load_evidence, save_evidence  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description="Import extension JSON export into evidence.json")
    p.add_argument("source", type=Path, help="Exported JSON file from the extension")
    p.add_argument(
        "--out",
        type=Path,
        default=ROOT / "evidence.json",
        help="Target evidence.json path",
    )
    p.add_argument(
        "--merge",
        action="store_true",
        help="Merge with existing records (by id); default is replace",
    )
    args = p.parse_args()

    if not args.source.exists():
        print(f"File not found: {args.source}", file=sys.stderr)
        return 1

    with args.source.open(encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        print("Expected a JSON array of evidence records.", file=sys.stderr)
        return 1

    if args.merge:
        existing = load_evidence(args.out)
        by_id = {r.get("id"): r for r in existing if r.get("id")}
        for rec in data:
            rid = rec.get("id")
            if rid and rid in by_id:
                by_id[rid] = rec
            else:
                existing.append(rec)
                if rid:
                    by_id[rid] = rec
        # rebuild unique list preserving order of existing then new-only
        seen = set()
        merged = []
        for r in existing:
            key = r.get("id") or id(r)
            if key not in seen:
                seen.add(key)
                merged.append(r)
        for r in data:
            key = r.get("id") or id(r)
            if key not in seen:
                seen.add(key)
                merged.append(r)
        save_evidence(merged, args.out)
        print(f"Merged. Total records: {len(merged)} → {args.out}")
    else:
        save_evidence(data, args.out)
        print(f"Imported {len(data)} record(s) → {args.out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
