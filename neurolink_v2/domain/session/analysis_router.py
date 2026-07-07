from __future__ import annotations

import csv
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()


@router.post("/analyze-latest")
async def analyze_latest_session():
    repo_root = Path.home() / "Neurolink-v2"
    script_path = repo_root / "tools" / "analyze_session.py"

    if not script_path.exists():
        return {
            "status": "error",
            "stderr": f"Analyzer script not found: {script_path}",
            "stdout": "",
        }

    proc = subprocess.run(
        [sys.executable, str(script_path)],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
    )

    if proc.returncode != 0:
        return {
            "status": "error",
            "stderr": proc.stderr or "Analyzer exited with non-zero status",
            "stdout": proc.stdout,
        }

    lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
    if len(lines) < 3:
        return {
            "status": "error",
            "stderr": "Analyzer did not return expected output paths",
            "stdout": proc.stdout,
        }

    timeseries_csv, summary_csv, bands_png = lines[-3:]

    def resolve_output_path(value: str) -> Path:
        return Path(value) if value.startswith("/") else (repo_root / value)

    timeseries_path = resolve_output_path(timeseries_csv)
    summary_path = resolve_output_path(summary_csv)
    bands_path = resolve_output_path(bands_png)

    missing = []
    if not timeseries_path.exists():
        missing.append(str(timeseries_path))
    if not summary_path.exists():
        missing.append(str(summary_path))
    if not bands_path.exists():
        missing.append(str(bands_path))

    if missing:
        return {
            "status": "error",
            "stderr": "Analyzer reported artifact paths that do not exist",
            "stdout": proc.stdout,
            "missing_artifacts": missing,
        }

    summary = {}
    with summary_path.open("r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        first = next(reader, None)
        if first:
            summary = first

    return {
        "status": "ok",
        "timeseries_csv": timeseries_csv,
        "summary_csv": summary_csv,
        "bands_png": bands_png,
        "summary": summary,
    }


@router.get("/artifacts/{filename}")
async def get_analysis_artifact(filename: str):
    repo_root = Path.home() / "Neurolink-v2"
    output_dir = repo_root / "output"
    target = (output_dir / filename).resolve()

    if output_dir.resolve() not in target.parents and target != output_dir.resolve():
        raise HTTPException(status_code=400, detail="Invalid filename")

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")

    return FileResponse(str(target), filename=target.name)
