"""Radar puller (section 2c of project.md).

Original plan: MOSDAC volumetric DWR datasets (TERLS/SHAR) parsed with
`pyiwr` -> Py-ART -> CAPPI grid. MOSDAC access is still under review, so
`USE_LIVE_RADAR=true` instead pulls real quantitative reflectivity from
RainViewer (`nowcast/ingestion/rainviewer_radar.py`) — free, unauthenticated,
and its India coverage is itself built from IMD's public radar network, just
republished by a third party instead of pulled from MOSDAC directly. See
that module's docstring for the greyscale-to-dBZ decode.

Radial (Doppler) velocity has no public aggregator equivalent — it needs a
raw volumetric scan, which nothing but MOSDAC/IMD exposes — so `velocity_ms`
stays synthetic even with `USE_LIVE_RADAR=true`. This means the downburst
hazard rule (needs a real velocity couplet) never becomes "real" this way,
only hail/cloudburst (reflectivity-based) do. Falls back to fully synthetic
on any RainViewer fetch failure.

Writes CAPPI-like output to data/radar/<ts>.npz with keys: reflectivity_dbz,
velocity_ms, bbox, timestamp.
"""
import os
import sys
from datetime import datetime, timezone

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from nowcast.configs.settings import get_region_bbox, DATA_DIR
from nowcast.processing.synthetic_radar import generate_sequence, generate_velocity_frame

RADAR_DIR = os.path.join(DATA_DIR, "radar")

USE_LIVE_RADAR = os.getenv("USE_LIVE_RADAR", "false").lower() == "true"


def _fetch_live():
    from nowcast.ingestion.rainviewer_radar import fetch_reflectivity

    reflectivity = fetch_reflectivity(grid_size=64)
    velocity = generate_velocity_frame(t_min=0)  # no real Doppler source available
    return reflectivity, velocity


def _fetch_mock():
    frames, _ = generate_sequence(n_frames=1, dt_minutes=0)
    reflectivity = frames[0]
    velocity = generate_velocity_frame(t_min=0)
    return reflectivity, velocity


def pull():
    os.makedirs(RADAR_DIR, exist_ok=True)
    try:
        reflectivity, velocity = _fetch_live() if USE_LIVE_RADAR else _fetch_mock()
    except Exception as exc:
        print(f"[radar_puller] live fetch failed ({exc}), falling back to mock", file=sys.stderr)
        reflectivity, velocity = _fetch_mock()

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = os.path.join(RADAR_DIR, f"{ts}.npz")
    np.savez(out_path, reflectivity_dbz=reflectivity, velocity_ms=velocity, bbox=np.array(get_region_bbox()))
    print(f"[radar_puller] wrote CAPPI reflectivity+velocity -> {out_path}")
    return out_path


if __name__ == "__main__":
    pull()
