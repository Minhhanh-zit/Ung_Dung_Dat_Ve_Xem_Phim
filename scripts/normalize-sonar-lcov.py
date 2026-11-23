#!/usr/bin/env python3
"""Normalize mono-repo LCOV paths for SonarQube and reject misleading reports.

Usage: python3 scripts/normalize-sonar-lcov.py backend/coverage/lcov.info backend
       python3 scripts/normalize-sonar-lcov.py admin-web/coverage/lcov.info admin-web
"""
from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[2] not in {"backend", "admin-web"}:
        print("Usage: normalize-sonar-lcov.py <lcov-file> <backend|admin-web>")
        return 2

    report = Path(sys.argv[1])
    component = sys.argv[2]
    root = Path.cwd().resolve()
    if not report.is_file():
        print(f"ERROR: Missing LCOV report: {report}")
        return 1

    normalized: list[str] = []
    sources: list[str] = []
    for line in report.read_text(encoding="utf-8").splitlines():
        if line.startswith("SF:"):
            filename = line[3:].strip().replace("\\", "/")
            p = Path(filename)
            if p.is_absolute():
                try:
                    filename = p.resolve().relative_to(root).as_posix()
                except ValueError:
                    pass
            filename = filename.removeprefix("./")
            if filename.startswith("src/"):
                filename = f"{component}/{filename}"
            if filename.startswith(f"{component}/src/"):
                sources.append(filename)
            line = "SF:" + filename
        normalized.append(line)

    if not sources:
        print(f"ERROR: LCOV has no {component}/src/ records: {report}")
        return 1
    missing = [p for p in sources if not Path(p).is_file()]
    if missing:
        print("ERROR: LCOV source files absent in repository:", missing[:10])
        return 1
    if not any(line.startswith("DA:") for line in normalized):
        print(f"ERROR: LCOV has no coverage lines: {report}")
        return 1

    report.write_text("\n".join(normalized) + "\n", encoding="utf-8")
    print(f"Validated {report}: {len(set(sources))} source files matched {component}/src/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
