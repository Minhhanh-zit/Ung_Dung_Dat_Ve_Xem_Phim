#!/usr/bin/env python3
"""Normalize CI-generated LCOV paths without accepting arbitrary output paths.

Usage: python3 scripts/normalize-sonar-lcov.py backend
       python3 scripts/normalize-sonar-lcov.py admin-web
"""
from __future__ import annotations

import sys
from pathlib import Path

REPORTS = {
    "backend": Path("backend/coverage/lcov.info"),
    "admin-web": Path("admin-web/coverage/lcov.info"),
}


def normalize_source(raw: str, component: str, root: Path) -> str | None:
    value = raw.strip().replace("\\", "/")
    if not value:
        raise ValueError("Empty LCOV source path")
    path = Path(value)
    if not path.is_absolute() and value.startswith("src/"):
        path = Path(component) / path
    resolved = (path if path.is_absolute() else root / path).resolve()
    if not resolved.is_relative_to(root):
        raise ValueError("LCOV source path escapes checkout")
    source_root = (root / component / "src").resolve()
    if not resolved.is_relative_to(source_root):
        return None  # Ignore test, generated, and other non-runtime records.
    if not resolved.is_file():
        raise ValueError("LCOV refers to a missing runtime source")
    return resolved.relative_to(root).as_posix()


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in REPORTS:
        print("Usage: normalize-sonar-lcov.py <backend|admin-web>")
        return 2

    component = sys.argv[1]
    root = Path.cwd().resolve()
    report = root / REPORTS[component]
    if report.is_symlink() or not report.is_file():
        print(f"ERROR: Missing or symlinked LCOV report for {component}")
        return 1

    content = report.read_text(encoding="utf-8")
    records = []
    current = []
    for line in content.splitlines():
        if line.strip() == "end_of_record":
            current.append(line)
            records.append(current)
            current = []
        else:
            current.append(line)
    if any(line.strip() for line in current):
        print("ERROR: Incomplete LCOV record")
        return 1

    normalized = []
    source_files = set()
    for record in records:
        source_lines = [line for line in record if line.startswith("SF:")]
        if len(source_lines) != 1:
            print("ERROR: Malformed LCOV source record")
            return 1
        try:
            source = normalize_source(source_lines[0][3:], component, root)
        except ValueError:
            print("ERROR: Invalid or missing LCOV source")
            return 1
        if source is None:
            continue
        if not any(line.startswith("DA:") for line in record):
            print("ERROR: Missing coverage line data for runtime source")
            return 1
        source_files.add(source)
        normalized.extend(
            "SF:" + source if line.startswith("SF:") else line for line in record
        )

    if not source_files:
        print("ERROR: LCOV contains no real runtime source coverage")
        return 1
    report.write_text("\n".join(normalized) + "\n", encoding="utf-8")
    print(f"Validated {component} LCOV: {len(source_files)} runtime source files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
