"""Run the database safety gate before Vercel builds the API."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]


def run_alembic(*arguments: str) -> None:
    command = [sys.executable, "-m", "alembic", *arguments]
    print(f"[predeploy] running: {' '.join(command)}", flush=True)
    completed = subprocess.run(command, cwd=API_ROOT, check=False)
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)


if __name__ == "__main__":
    # Upgrade first so a release never builds against an older schema. The
    # check then fails the build if the ORM metadata still drifts from it.
    run_alembic("upgrade", "head")
    run_alembic("check")
