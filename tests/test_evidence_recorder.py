"""Unit tests for evidence_recorder CLI and helpers."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from evidence_recorder import (
    VALID_STATUSES,
    build_record,
    export_html,
    load_evidence,
    main,
    parse_args,
    save_evidence,
)


@pytest.fixture
def tmp_evidence(tmp_path: Path) -> Path:
    return tmp_path / "evidence.json"


def test_build_record_defaults():
    rec = build_record(test_name="Login", status="pass")
    assert rec["test_name"] == "Login"
    assert rec["status"] == "PASS"
    assert rec["tags"] == []
    assert "id" in rec
    assert "recorded_at" in rec


def test_build_record_with_tags():
    rec = build_record(
        test_name="Search",
        status="FAIL",
        expected="results",
        actual="error",
        tags=["smoke", "search"],
        notes="bug-123",
        page_url="https://example.com",
    )
    assert rec["status"] == "FAIL"
    assert rec["tags"] == ["smoke", "search"]
    assert rec["notes"] == "bug-123"
    assert rec["page_url"] == "https://example.com"


def test_save_and_load_roundtrip(tmp_evidence: Path):
    records = [
        build_record("A", "PASS"),
        build_record("B", "FAIL", tags=["ui"]),
    ]
    save_evidence(records, tmp_evidence)
    loaded = load_evidence(tmp_evidence)
    assert len(loaded) == 2
    assert loaded[0]["test_name"] == "A"
    assert loaded[1]["tags"] == ["ui"]


def test_load_missing_file(tmp_path: Path):
    assert load_evidence(tmp_path / "missing.json") == []


def test_load_invalid_json(tmp_path: Path):
    bad = tmp_path / "bad.json"
    bad.write_text("{not json", encoding="utf-8")
    assert load_evidence(bad) == []


def test_cli_noninteractive(tmp_evidence: Path, monkeypatch):
    monkeypatch.setattr(
        "sys.argv",
        [
            "evidence_recorder.py",
            "--test",
            "CLI Test",
            "--status",
            "PASS",
            "--expected",
            "ok",
            "--actual",
            "ok",
            "--tags",
            "cli,auto",
            "--file",
            str(tmp_evidence),
        ],
    )
    # Call main with explicit argv instead
    code = main(
        [
            "--test",
            "CLI Test",
            "--status",
            "PASS",
            "--expected",
            "ok",
            "--actual",
            "ok",
            "--tags",
            "cli,auto",
            "--file",
            str(tmp_evidence),
        ]
    )
    assert code == 0
    loaded = load_evidence(tmp_evidence)
    assert len(loaded) == 1
    assert loaded[0]["test_name"] == "CLI Test"
    assert loaded[0]["tags"] == ["cli", "auto"]


def test_cli_list(tmp_evidence: Path, capsys):
    save_evidence([build_record("X", "PASS")], tmp_evidence)
    code = main(["--list", "--file", str(tmp_evidence)])
    assert code == 0
    out = capsys.readouterr().out
    assert "X" in out
    assert "Total: 1" in out


def test_cli_export_html(tmp_evidence: Path, tmp_path: Path):
    save_evidence(
        [build_record("Export Me", "FAIL", expected="a", actual="b")],
        tmp_evidence,
    )
    out_html = tmp_path / "report.html"
    code = main(["--export-html", str(out_html), "--file", str(tmp_evidence)])
    assert code == 0
    text = out_html.read_text(encoding="utf-8")
    assert "Export Me" in text
    assert "FAIL" in text


def test_export_html_function(tmp_path: Path):
    records = [build_record("T", "PASS")]
    out = tmp_path / "r.html"
    export_html(records, out)
    assert out.exists()
    assert "T" in out.read_text(encoding="utf-8")


def test_parse_args_defaults():
    args = parse_args([])
    assert args.list is False
    assert args.test_name is None


def test_valid_statuses():
    assert "PASS" in VALID_STATUSES
    assert "BLOCKED" in VALID_STATUSES
