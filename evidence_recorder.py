#!/usr/bin/env python3
"""
CLI evidence recorder – append structured test evidence to evidence.json.

Usage:
  python evidence_recorder.py
  python evidence_recorder.py --test "Login" --status PASS --expected "..." --actual "..."
  python evidence_recorder.py --list
  python evidence_recorder.py --export-html report.html
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

EVIDENCE_FILE = Path(__file__).resolve().parent / "evidence.json"
VALID_STATUSES = {"PASS", "FAIL", "BLOCKED", "SKIP"}


def load_evidence(path: Path = EVIDENCE_FILE) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            return []
        return data
    except (json.JSONDecodeError, OSError) as exc:
        print(f"Warning: could not read {path}: {exc}", file=sys.stderr)
        return []


def save_evidence(records: list[dict[str, Any]], path: Path = EVIDENCE_FILE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
        f.write("\n")


def prompt_nonempty(label: str) -> str:
    while True:
        value = input(f"{label}: ").strip()
        if value:
            return value
        print("  Value cannot be empty.")


def prompt_status() -> str:
    while True:
        value = input("Status (PASS/FAIL/BLOCKED/SKIP) [PASS]: ").strip().upper()
        if not value:
            return "PASS"
        if value in VALID_STATUSES:
            return value
        print(f"  Invalid. Choose from: {', '.join(sorted(VALID_STATUSES))}")


def prompt_tags() -> list[str]:
    raw = input("Tags (comma-separated, optional): ").strip()
    if not raw:
        return []
    return [t.strip().lower() for t in raw.replace(";", ",").split(",") if t.strip()]


def build_record(
    test_name: str,
    status: str,
    expected: str = "",
    actual: str = "",
    tags: list[str] | None = None,
    notes: str = "",
    page_url: str = "",
    page_title: str = "",
) -> dict[str, Any]:
    return {
        "id": str(uuid4()),
        "test_name": test_name,
        "status": status.upper(),
        "expected": expected,
        "actual": actual,
        "tags": tags or [],
        "notes": notes,
        "page_title": page_title,
        "page_url": page_url,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }


def interactive_record() -> dict[str, Any]:
    print("\n=== Test Evidence Recorder ===\n")
    test_name = prompt_nonempty("Test name")
    status = prompt_status()
    expected = input("Expected result: ").strip()
    actual = input("Actual result: ").strip()
    tags = prompt_tags()
    notes = input("Notes (optional): ").strip()
    page_url = input("Page URL (optional): ").strip()
    page_title = input("Page title (optional): ").strip()
    return build_record(
        test_name=test_name,
        status=status,
        expected=expected,
        actual=actual,
        tags=tags,
        notes=notes,
        page_url=page_url,
        page_title=page_title,
    )


def list_records(records: list[dict[str, Any]]) -> None:
    if not records:
        print("No evidence records.")
        return
    for i, r in enumerate(records, 1):
        tags = ", ".join(r.get("tags") or []) or "—"
        print(
            f"{i:3d}. [{r.get('status', '?'):7s}] {r.get('test_name', '?')}\n"
            f"      tags={tags}  at={r.get('recorded_at', '?')}"
        )
    print(f"\nTotal: {len(records)}")


def export_html(records: list[dict[str, Any]], out_path: Path) -> None:
    rows = []
    for i, ev in enumerate(records, 1):
        tags = ", ".join(ev.get("tags") or []) or "—"
        rows.append(
            f"""
<section class="card">
  <h2>#{i} {html_escape(ev.get('test_name', ''))}
    <span class="status">{html_escape(ev.get('status', ''))}</span>
  </h2>
  <p><strong>Expected:</strong> {html_escape(ev.get('expected') or '—')}</p>
  <p><strong>Actual:</strong> {html_escape(ev.get('actual') or '—')}</p>
  <p><strong>Notes:</strong> {html_escape(ev.get('notes') or '—')}</p>
  <p><strong>Tags:</strong> {html_escape(tags)}</p>
  <p><strong>URL:</strong> {html_escape(ev.get('page_url') or '—')}</p>
  <p><strong>Recorded:</strong> {html_escape(ev.get('recorded_at') or '—')}</p>
</section>"""
        )
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Test Evidence Report</title>
<style>
  body{{font-family:system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px}}
  h1{{border-bottom:2px solid #4f8cff;padding-bottom:8px}}
  .card{{border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0;background:#fafafa}}
  .status{{font-size:12px;background:#e8f0fe;padding:2px 8px;border-radius:999px;margin-left:8px}}
</style>
</head>
<body>
<h1>Test Evidence Report</h1>
<p>Generated {datetime.now(timezone.utc).isoformat()} · {len(records)} record(s)</p>
{"".join(rows) if rows else "<p>No records.</p>"}
</body>
</html>
"""
    out_path.write_text(html, encoding="utf-8")
    print(f"HTML report written to {out_path}")


def html_escape(s: str) -> str:
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Record and manage test evidence.")
    p.add_argument("--test", dest="test_name", help="Test name (non-interactive)")
    p.add_argument("--status", choices=sorted(VALID_STATUSES), help="PASS/FAIL/BLOCKED/SKIP")
    p.add_argument("--expected", default="", help="Expected result")
    p.add_argument("--actual", default="", help="Actual result")
    p.add_argument("--tags", default="", help="Comma-separated tags")
    p.add_argument("--notes", default="", help="Notes")
    p.add_argument("--url", default="", help="Page URL")
    p.add_argument("--title", default="", help="Page title")
    p.add_argument("--list", action="store_true", help="List existing records")
    p.add_argument("--export-html", metavar="FILE", help="Export HTML report")
    p.add_argument("--file", type=Path, default=EVIDENCE_FILE, help="Evidence JSON path")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    records = load_evidence(args.file)

    if args.list:
        list_records(records)
        return 0

    if args.export_html:
        export_html(records, Path(args.export_html))
        return 0

    if args.test_name:
        if not args.status:
            print("--status is required with --test", file=sys.stderr)
            return 2
        tags = [t.strip().lower() for t in args.tags.replace(";", ",").split(",") if t.strip()]
        rec = build_record(
            test_name=args.test_name,
            status=args.status,
            expected=args.expected,
            actual=args.actual,
            tags=tags,
            notes=args.notes,
            page_url=args.url,
            page_title=args.title,
        )
    else:
        rec = interactive_record()

    records.append(rec)
    save_evidence(records, args.file)
    print()
    print("Evidence saved successfully.")
    print(f"Total evidence records: {len(records)}")
    print(f"File: {args.file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
