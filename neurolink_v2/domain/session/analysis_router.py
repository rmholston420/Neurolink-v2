from __future__ import annotations

import csv
import json
from datetime import datetime
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from neurolink_v2.domain.signal.quality import compute_session_guidance

router = APIRouter()


def _safe_float(value: str | float | None, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _harden_summary_ratios(summary: dict) -> dict:
    summary = dict(summary)

    summary.setdefault("delta", summary.get("mean_delta"))
    summary.setdefault("theta", summary.get("mean_theta"))
    summary.setdefault("alpha", summary.get("mean_alpha"))
    summary.setdefault("beta", summary.get("mean_beta"))
    summary.setdefault("gamma", summary.get("mean_gamma"))

    delta = _safe_float(summary.get("delta"))
    theta = _safe_float(summary.get("theta"))
    alpha = _safe_float(summary.get("alpha"))
    beta = _safe_float(summary.get("beta"))
    gamma = _safe_float(summary.get("gamma"))

    total = delta + theta + alpha + beta + gamma
    alpha_beta = alpha + beta

    summary["slow_over_total"] = (delta + theta) / total if total > 0.0 else 0.0
    summary["fast_over_total"] = (beta + gamma) / total if total > 0.0 else 0.0
    summary["alpha_over_alpha_beta"] = alpha / alpha_beta if alpha_beta > 0.0 else 0.0
    return summary


def _manifest_path_for_session(session_path: Path) -> Path:
    return session_path.with_suffix(".manifest.json")


def _load_session_manifest(session_path: Path) -> dict | None:
    manifest_path = _manifest_path_for_session(session_path)
    try:
        with manifest_path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception:
        return None

    return data if isinstance(data, dict) else None


def _line_count_recording_label_for_session(session_path: Path) -> str:
    try:
        line_count = 0
        with session_path.open("r", encoding="utf-8") as fh:
            for _ in fh:
                line_count += 1
    except Exception:
        return "unknown"

    return "short" if line_count < 20 else "ok"


def _recording_metadata_for_session(session_path: Path | None) -> dict:
    if session_path is None:
        return {
            "recording_label": "unknown",
            "recording_metadata_source": "unknown",
        }

    manifest = _load_session_manifest(session_path)
    if manifest:
        label = str(
            manifest.get("recording_label")
            or manifest.get("session_label")
            or "unknown"
        )
        return {
            "recording_label": label,
            "duration_seconds": manifest.get("duration_seconds"),
            "packet_counts": manifest.get("packet_counts"),
            "eeg_packets": manifest.get("eeg_packets"),
            "start_time": manifest.get("start_time"),
            "stop_time": manifest.get("stop_time"),
            "manifest_path": str(_manifest_path_for_session(session_path)),
            "recording_metadata_source": "manifest",
        }

    return {
        "recording_label": _line_count_recording_label_for_session(session_path),
        "recording_metadata_source": "fallback",
    }

def _inject_short_session_caution(summary: dict, session_path: Path | None) -> dict:
    summary = dict(summary)
    metadata = _recording_metadata_for_session(session_path)
    label = str(metadata.get("recording_label", "unknown"))
    summary["recording_label"] = label
    summary["short_session"] = label == "short"
    summary["short_session_caution"] = (
        "Recording is short; treat post-session interpretation as lower confidence."
        if label == "short"
        else None
    )
    return summary



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
            summary = dict(first)

    summary = _harden_summary_ratios(summary)

    overall_quality = str(summary.get("overall_quality", "fair"))
    summary.update(
        compute_session_guidance(
            slow_over_total=_safe_float(summary.get("slow_over_total")),
            fast_over_total=_safe_float(summary.get("fast_over_total")),
            alpha_over_alpha_beta=_safe_float(summary.get("alpha_over_alpha_beta")),
            overall_quality=overall_quality,
        )
    )

    session_files = sorted((repo_root / "data" / "sessions").glob("session-*.jsonl"))
    latest_session = session_files[-1] if session_files else None
    recording_metadata = _recording_metadata_for_session(latest_session)
    summary = _inject_short_session_caution(summary, latest_session)

    return {
        "status": "ok",
        "timeseries_csv": timeseries_csv,
        "summary_csv": summary_csv,
        "bands_png": bands_png,
        "summary": summary,
        "recording_metadata": recording_metadata,
    }




@router.post("/analyze-by-name/{session_name}")
async def analyze_session_by_name(session_name: str):
    repo_root = Path.home() / "Neurolink-v2"
    script_path = repo_root / "tools" / "analyze_session.py"
    session_dir = repo_root / "data" / "sessions"
    session_path = (session_dir / session_name).resolve()

    if not script_path.exists():
        return {
            "status": "error",
            "stderr": f"Analyzer script not found: {script_path}",
            "stdout": "",
        }

    if session_dir.resolve() not in session_path.parents or session_path.suffix != ".jsonl":
        raise HTTPException(status_code=400, detail="Invalid session filename")

    if not session_path.exists() or not session_path.is_file():
        raise HTTPException(status_code=404, detail="Session file not found")

    proc = subprocess.run(
        [sys.executable, str(script_path), str(session_path)],
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
            summary = dict(first)

    summary = _harden_summary_ratios(summary)

    overall_quality = str(summary.get("overall_quality", "fair"))
    summary.update(
        compute_session_guidance(
            slow_over_total=_safe_float(summary.get("slow_over_total")),
            fast_over_total=_safe_float(summary.get("fast_over_total")),
            alpha_over_alpha_beta=_safe_float(summary.get("alpha_over_alpha_beta")),
            overall_quality=overall_quality,
        )
    )

    recording_metadata = _recording_metadata_for_session(session_path)
    summary = _inject_short_session_caution(summary, session_path)

    return {
        "status": "ok",
        "timeseries_csv": timeseries_csv,
        "summary_csv": summary_csv,
        "bands_png": bands_png,
        "summary": summary,
        "recording_metadata": recording_metadata,
    }



@router.get("/history/list")
async def list_session_history():
    repo_root = Path.home() / "Neurolink-v2"
    session_dir = repo_root / "data" / "sessions"
    output_dir = repo_root / "output"

    rows = []
    for session_path in sorted(session_dir.glob("session-*.jsonl"), reverse=True):
        stem = session_path.stem
        summary_csv = output_dir / f"{stem}-summary.csv"
        timeseries_csv = output_dir / f"{stem}-band-timeseries.csv"
        bands_png = output_dir / f"{stem}-bands.png"

        timestamp = stem.removeprefix("session-")
        display_time = timestamp
        try:
            parsed = datetime.strptime(timestamp, "%Y%m%d-%H%M%S")
            display_time = parsed.isoformat()
        except ValueError:
            pass

        analyzed = summary_csv.exists() and timeseries_csv.exists() and bands_png.exists()
        recording_metadata = _recording_metadata_for_session(session_path)

        summary = None
        if summary_csv.exists():
            with summary_csv.open("r", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                first = next(reader, None)
                if first:
                    summary = _harden_summary_ratios(dict(first))
                    overall_quality = str(summary.get("overall_quality", "fair"))
                    summary.update(
                        compute_session_guidance(
                            slow_over_total=_safe_float(summary.get("slow_over_total")),
                            fast_over_total=_safe_float(summary.get("fast_over_total")),
                            alpha_over_alpha_beta=_safe_float(summary.get("alpha_over_alpha_beta")),
                            overall_quality=overall_quality,
                        )
                    )

        rows.append({
            "session_file": str(session_path),
            "session_name": session_path.name,
            "timestamp": display_time,
            "analyzed": analyzed,
            "recording_metadata": recording_metadata,
            "recording_label": recording_metadata.get("recording_label", "unknown"),
            "summary_csv": str(summary_csv.relative_to(repo_root)) if summary_csv.exists() else None,
            "timeseries_csv": str(timeseries_csv.relative_to(repo_root)) if timeseries_csv.exists() else None,
            "bands_png": str(bands_png.relative_to(repo_root)) if bands_png.exists() else None,
            "summary": summary,
        })

    return {
        "status": "ok",
        "sessions": rows,
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
