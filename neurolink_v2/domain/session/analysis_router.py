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

    proc = subprocess.run(
        [sys.executable, str(script_path)],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
    )

    if proc.returncode != 0:
        return {
            "status": "error",
            "stderr": proc.stderr,
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

    summary = {}
    summary_path = repo_root / summary_csv if not summary_csv.startswith("/") else Path(summary_csv)
    if summary_path.exists():
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
