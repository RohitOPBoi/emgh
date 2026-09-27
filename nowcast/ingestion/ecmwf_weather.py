"""Real ECMWF Open Data ingestion — temperature, humidity, wind.

No API key needed. ECMWF's older key-based public-datasets service
(api.ecmwf.int) was mostly decommissioned in 2023 — what's left (S2S,
TIGGE) is weeks-to-months scale, useless for nowcasting. This uses their
newer Open Data service instead (`ecmwf-opendata` package), which is
genuinely free and unauthenticated: real HRES operational forecast,
0.25-degree resolution, updated 4x/day (00/06/12/18 UTC), CC-BY-4.0
licensed (attribution required, see README).

Steps are every 3h. `fetch_grid(lead_minutes)` rounds to the nearest
available step and caches each step's processed grid in-memory (ECMWF
only updates every 6h, so there's no need to re-download per request).

Downloads are global GRIB2 files (no server-side bbox filtering in this
API) — a few MB each, subset locally to WIDE_BBOX after decoding.
"""
import concurrent.futures
import os
import sys
import tempfile
import time

import numpy as np
import xarray as xr
from ecmwf.opendata import Client

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from nowcast.configs.settings import get_wide_bbox, WIDE_GRID_SIZE

# The client's own defaults (maximum_retries=500, retry_after=120s) are
# built for a long-running batch job, not a request that has to fail fast
# and fall back to synthetic data — with those defaults, a single
# transient hiccup (rate limiting, a network blip) can make a request
# retry for hours with no way to tell it apart from "still downloading".
# 3 retries with a much shorter backoff still tolerates real transient
# failures without ever looking like a permanent hang.
_CLIENT = Client(source="ecmwf", maximum_retries=3, retry_after=5)
_CACHE = {}  # (step, wide_bbox) -> (fetched_at_epoch, grid_dict) — keyed by
# bbox too since get_wide_bbox() now follows the active region, not a
# fixed constant; serving a cached Maharashtra grid while viewing Delhi
# would be wrong instead of just stale.
_CACHE_TTL_SECONDS = 3 * 3600  # well under ECMWF's 6h update cadence
_FETCH_TIMEOUT_SECONDS = 25  # the package sets no HTTP timeout of its own —
# a real network hang (not just an error) would otherwise block forever


def _nearest_step(lead_minutes):
    hours = lead_minutes / 60.0
    return max(0, round(hours / 3.0) * 3)


def _subset(ds, lon_min, lat_min, lon_max, lat_max):
    lons = xr.where(ds.longitude > 180, ds.longitude - 360, ds.longitude)
    ds = ds.assign_coords(longitude=lons).sortby("longitude")
    return ds.sel(longitude=slice(lon_min, lon_max), latitude=slice(lat_max, lat_min))


def _regrid(values, src_lats, src_lons, dst_lat_grid, dst_lon_grid):
    from scipy.interpolate import RegularGridInterpolator

    # RegularGridInterpolator needs strictly increasing coordinates
    lat_order = np.argsort(src_lats)
    interp = RegularGridInterpolator(
        (src_lats[lat_order], src_lons), values[lat_order, :], bounds_error=False, fill_value=None
    )
    pts = np.stack([dst_lat_grid.ravel(), dst_lon_grid.ravel()], axis=-1)
    return interp(pts).reshape(dst_lat_grid.shape)


def _saturation_vapor_pressure(temp_c):
    """Magnus-Tetens approximation, used to derive relative humidity from
    temperature + dewpoint since ECMWF Open Data doesn't expose 'r' at a
    consistent level without a separate isobaric-level request."""
    return 6.112 * np.exp((17.62 * temp_c) / (243.12 + temp_c))


def _fetch_and_process(step, wide_bbox):
    tmp_dir = tempfile.mkdtemp(prefix="ecmwf_")
    t_path = os.path.join(tmp_dir, "t2.grib2")
    w_path = os.path.join(tmp_dir, "wind10.grib2")
    p_path = os.path.join(tmp_dir, "msl.grib2")
    # three separate retrievals: 2t/2d (heightAboveGround=2), 10u/10v
    # (heightAboveGround=10), and msl (meanSea level) each need their own
    # cfgrib dataset — cfgrib refuses to merge different level types.
    _CLIENT.retrieve(type="fc", step=step, param=["2t", "2d"], target=t_path)
    _CLIENT.retrieve(type="fc", step=step, param=["10u", "10v"], target=w_path)
    _CLIENT.retrieve(type="fc", step=step, param=["msl"], target=p_path)

    t_ds = xr.open_dataset(t_path, engine="cfgrib")
    w_ds = xr.open_dataset(w_path, engine="cfgrib")
    p_ds = xr.open_dataset(p_path, engine="cfgrib")

    lon_min, lat_min, lon_max, lat_max = wide_bbox
    pad = 0.5  # margin so interpolation has real neighbors at the grid edges
    t_sub = _subset(t_ds, lon_min - pad, lat_min - pad, lon_max + pad, lat_max + pad)
    w_sub = _subset(w_ds, lon_min - pad, lat_min - pad, lon_max + pad, lat_max + pad)
    p_sub = _subset(p_ds, lon_min - pad, lat_min - pad, lon_max + pad, lat_max + pad)

    lons_t = np.linspace(lon_min, lon_max, WIDE_GRID_SIZE)
    lats_t = np.linspace(lat_min, lat_max, WIDE_GRID_SIZE)
    lon_grid, lat_grid = np.meshgrid(lons_t, lats_t)

    t2m_k = _regrid(t_sub.t2m.values, t_sub.latitude.values, t_sub.longitude.values, lat_grid, lon_grid)
    d2m_k = _regrid(t_sub.d2m.values, t_sub.latitude.values, t_sub.longitude.values, lat_grid, lon_grid)
    u10 = _regrid(w_sub.u10.values, w_sub.latitude.values, w_sub.longitude.values, lat_grid, lon_grid)
    v10 = _regrid(w_sub.v10.values, w_sub.latitude.values, w_sub.longitude.values, lat_grid, lon_grid)
    msl_pa = _regrid(p_sub.msl.values, p_sub.latitude.values, p_sub.longitude.values, lat_grid, lon_grid)

    temperature_c = t2m_k - 273.15
    dewpoint_c = d2m_k - 273.15
    humidity_pct = np.clip(100 * _saturation_vapor_pressure(dewpoint_c) / _saturation_vapor_pressure(temperature_c), 0, 100)
    wind_speed_ms = np.sqrt(u10**2 + v10**2)
    # meteorological convention: direction wind is blowing FROM
    wind_dir_deg = (np.degrees(np.arctan2(-u10, -v10)) + 360) % 360
    pressure_hpa = msl_pa / 100.0

    return {
        "temperature_c": temperature_c.astype(np.float32),
        "humidity_pct": humidity_pct.astype(np.float32),
        "wind_speed_ms": wind_speed_ms.astype(np.float32),
        "wind_dir_deg": wind_dir_deg.astype(np.float32),
        "pressure_hpa": pressure_hpa.astype(np.float32),
        "bbox": wide_bbox,
        "grid_size": WIDE_GRID_SIZE,
        "source": "ecmwf-opendata",
        "step_hours": step,
    }


def fetch_grid(lead_minutes=0):
    """Real ECMWF HRES grid for the nearest available forecast step.
    Raises on any failure (network, decode, missing package, or a hard
    timeout — see _FETCH_TIMEOUT_SECONDS) — callers (weather_fields.py)
    catch this and fall back to the synthetic generator, same pattern as
    every other live-data source in this repo.
    """
    step = _nearest_step(lead_minutes)
    wide_bbox = get_wide_bbox()
    cache_key = (step, wide_bbox)
    cached = _CACHE.get(cache_key)
    if cached and (time.time() - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    # Deliberately not a `with` block: ThreadPoolExecutor.__exit__ calls
    # shutdown(wait=True), which blocks until the worker thread finishes
    # regardless of the timeout below — that would silently defeat the
    # whole point of this wrapper. shutdown(wait=False) lets the caller give
    # up on time without waiting for a hung thread to ever finish (Python
    # can't forcibly kill a thread; the orphaned download just gets
    # abandoned and eventually errors out or completes uselessly on its own).
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    future = pool.submit(_fetch_and_process, step, wide_bbox)
    try:
        grid = future.result(timeout=_FETCH_TIMEOUT_SECONDS)
    except concurrent.futures.TimeoutError:
        pool.shutdown(wait=False)
        raise RuntimeError(f"ECMWF fetch exceeded {_FETCH_TIMEOUT_SECONDS}s, giving up") from None
    pool.shutdown(wait=False)

    _CACHE[cache_key] = (time.time(), grid)
    return grid


if __name__ == "__main__":
    g = fetch_grid(0)
    for k in ["temperature_c", "humidity_pct", "wind_speed_ms", "wind_dir_deg", "pressure_hpa"]:
        arr = g[k]
        print(f"{k}: min={arr.min():.1f} max={arr.max():.1f} mean={arr.mean():.1f}")
