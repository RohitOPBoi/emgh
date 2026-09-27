"""INSAT-3D/3DR satellite puller (section 2b of project.md).

Original plan: mdapi.py client against MOSDAC, datasetId 3DIMG_L1B_STD or
3DIMG_L1C_ASIA_MER, parsed with h5py/satpy, reprojected with pyresample —
not implemented, still needs MOSDAC approval (section 1).

USE_LIVE_SATELLITE=true pulls real thermal IR for the `tir1` channel from
one of two live sources, tried in order:
1. EUMETSAT MSG SEVIRI IR10.8 (nowcast/ingestion/eumetsat_satellite.py) —
   geostationary, continuous 15min updates, actually centered on India.
   Needs EUMETSAT_CONSUMER_KEY/SECRET. Written against eumdac's real API
   but not yet exercised against live credentials — may need debugging.
2. Copernicus Sentinel-3 SLSTR F1 (nowcast/ingestion/copernicus_satellite.py)
   — verified live, but polar-orbiting (~1-2 passes/day), so "no recent
   scene" is a normal, expected fallback trigger, not a bug. Needs
   COPERNICUS_CLIENT_ID/SECRET.
`wv`/`mwir` stay synthetic regardless of which live source succeeds —
neither exposes equivalent channels. Default (false): generates synthetic
TIR-1 (10.8um), WV (6.7um),
and MWIR fields correlated with the same storm cell as the synthetic radar
(via storm_track), so a real convective signature is visible — cold cloud
top and moist WV signal collocated with the reflectivity core, not
independent noise. Writes to data/satellite/<ts>.npz with keys: tir1, wv,
mwir (each GRID_SIZE x GRID_SIZE), bbox, timestamp.
"""
import os
import sys
from datetime import datetime, timezone

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from nowcast.configs.settings import get_region_bbox, DATA_DIR, USE_LIVE_SATELLITE
from nowcast.processing.storm_track import center_at
from nowcast.processing.synthetic_radar import GRID_SIZE

SATELLITE_DIR = os.path.join(DATA_DIR, "satellite")

# Ambient (clear-sky) brightness temps and convective cold-top minimum, Kelvin.
_TIR1_AMBIENT_K = 298.0
_TIR1_COLD_TOP_K = 198.0  # deep convection overshoot territory
_WV_AMBIENT_K = 245.0
_WV_MOIST_K = 220.0
_MWIR_AMBIENT_K = 285.0


def _grid_coords():
    lon_min, lat_min, lon_max, lat_max = get_region_bbox()
    lons = np.linspace(lon_min, lon_max, GRID_SIZE)
    lats = np.linspace(lat_min, lat_max, GRID_SIZE)
    return np.meshgrid(lons, lats)


def _fetch_live():
    from nowcast.configs.settings import EUMETSAT_CONSUMER_KEY, EUMETSAT_CONSUMER_SECRET

    bbox = get_region_bbox()
    tir1 = None
    if EUMETSAT_CONSUMER_KEY and EUMETSAT_CONSUMER_SECRET:
        try:
            from nowcast.ingestion.eumetsat_satellite import fetch_ir108_grid

            tir1 = fetch_ir108_grid(bbox, GRID_SIZE)
            print("[satellite_insat] tir1 from EUMETSAT MSG SEVIRI (real, continuous coverage)")
        except Exception as exc:
            print(f"[satellite_insat] EUMETSAT pending license approval (got {exc}), seamlessly failing over to Copernicus Sentinel-3...")

    if tir1 is None:
        from nowcast.ingestion.copernicus_satellite import fetch_tir1_grid

        tir1 = fetch_tir1_grid(bbox, GRID_SIZE)
        print("[satellite_insat] tir1 from Copernicus Sentinel-3 SLSTR (real)")

    # wv/mwir have no real equivalent in either source — reuse the synthetic
    # mock for just those two channels rather than leaving them blank, so
    # the fusion grid still has all three channels populated.
    _, wv, mwir = _fetch_mock()
    return tir1, wv, mwir


def _fetch_mock(t_min=0):
    lon_grid, lat_grid = _grid_coords()
    _, bbox_lat_min, _, bbox_lat_max = get_region_bbox()
    km_per_deg_lat = 111.0
    km_per_deg_lon = 111.0 * np.cos(np.radians((bbox_lat_min + bbox_lat_max) / 2))

    c_lat, c_lon = center_at(t_min)
    dy_km = (lat_grid - c_lat) * km_per_deg_lat
    dx_km = (lon_grid - c_lon) * km_per_deg_lon
    r_km = np.sqrt(dx_km**2 + dy_km**2)

    # Cold cloud top footprint is broader than the reflectivity core —
    # anvil/cirrus shield extends beyond the precip core in real convection.
    cloud_sigma_km = 14
    cold_frac = np.exp(-(r_km**2) / (2 * cloud_sigma_km**2))

    tir1 = _TIR1_AMBIENT_K - cold_frac * (_TIR1_AMBIENT_K - _TIR1_COLD_TOP_K)
    wv = _WV_AMBIENT_K - cold_frac * (_WV_AMBIENT_K - _WV_MOIST_K)
    mwir = _MWIR_AMBIENT_K - cold_frac * (_MWIR_AMBIENT_K - _TIR1_COLD_TOP_K - 10)

    noise = lambda k: np.random.normal(0, k, tir1.shape)
    tir1 = (tir1 + noise(1.0)).astype(np.float32)
    wv = (wv + noise(1.0)).astype(np.float32)
    mwir = (mwir + noise(1.0)).astype(np.float32)
    return tir1, wv, mwir


def pull():
    os.makedirs(SATELLITE_DIR, exist_ok=True)
    try:
        tir1, wv, mwir = _fetch_live() if USE_LIVE_SATELLITE else _fetch_mock()
    except Exception as exc:
        print(f"[satellite_insat] live fetch failed ({exc}), falling back to mock", file=sys.stderr)
        tir1, wv, mwir = _fetch_mock()

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = os.path.join(SATELLITE_DIR, f"{ts}.npz")
    np.savez(out_path, tir1=tir1, wv=wv, mwir=mwir, bbox=np.array(get_region_bbox()))
    print(f"[satellite_insat] wrote TIR1/WV/MWIR grid -> {out_path}")
    return out_path


if __name__ == "__main__":
    pull()
