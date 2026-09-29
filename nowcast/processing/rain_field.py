"""Rain-rate field for the dashboard's rain simulation.

Turns a reflectivity (dBZ) or rain-rate (mm/hr) grid into a compact,
quantised field the browser can animate as falling rain, and — for lead
times > 0 — moves the field along the steering wind.

Two honest caveats, also surfaced to the UI through the `method` field:

* dBZ -> mm/hr uses the Marshall-Palmer relation Z = 200 R^1.6, the same
  one the /weather-layers rainfall raster uses, so both views agree.
* Lead-time motion is a semi-Lagrangian *advection of the current radar
  echo* by the ECMWF/ambient wind field (persistence + steering flow). It is
  not a re-detected or dynamically evolving forecast — growth/decay of
  cells is only modelled by the region-scale pySTEPS/DGMR pages.
"""
import base64

import numpy as np
from scipy import ndimage

SQRT_SCALE = 20.0  # uint8 = round(sqrt(mm/hr) * 20): 0.1 mm/hr steps at 1 mm/hr, saturates at ~162 mm/hr
MAX_SIDE = 160


def dbz_to_rate(dbz):
    """Marshall-Palmer Z = 200 R^1.6 (Z in mm^6/m^3)."""
    dbz = np.asarray(dbz, dtype=np.float32)
    rate = np.power(np.power(10.0, dbz / 10.0) / 200.0, 1.0 / 1.6)
    return np.where(dbz > 5.0, rate, 0.0).astype(np.float32)


def _resample(arr, out_h, out_w):
    zy = out_h / arr.shape[0]
    zx = out_w / arr.shape[1]
    return ndimage.zoom(arr, (zy, zx), order=1)


def advect(rate, bbox, wind_speed_ms, wind_dir_deg, lead_minutes):
    """Backward semi-Lagrangian advection of `rate` (row 0 = south edge) by a
    wind field given on any grid covering the same bbox. Wind direction is
    the meteorological "from" bearing, so the echo moves toward dir+180."""
    if lead_minutes <= 0:
        return rate
    h, w = rate.shape
    lon_min, lat_min, lon_max, lat_max = bbox
    wind_speed_ms = _resample(wind_speed_ms, h, w)
    # Interpolating a bearing directly wraps badly across 0/360, so
    # interpolate its sin/cos components instead.
    rad = np.radians(np.asarray(wind_dir_deg, dtype=np.float32))
    s = _resample(np.sin(rad), h, w)
    c = _resample(np.cos(rad), h, w)
    to = np.arctan2(s, c) + np.pi
    dist_km = wind_speed_ms * lead_minutes * 60.0 / 1000.0
    lats = np.linspace(lat_min, lat_max, h)[:, None]
    km_lat = 111.0
    km_lon = 111.0 * np.cos(np.radians(lats))
    d_north_km = dist_km * np.cos(to)
    d_east_km = dist_km * np.sin(to)
    cell_lat_km = (lat_max - lat_min) / (h - 1) * km_lat
    cell_lon_km = (lon_max - lon_min) / (w - 1) * km_lon
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    src_y = yy - d_north_km / cell_lat_km
    src_x = xx - d_east_km / cell_lon_km
    return ndimage.map_coordinates(rate, [src_y, src_x], order=1, mode="constant", cval=0.0).astype(np.float32)


def encode(rate, bbox, lead_minutes, source, method, wind_speed_ms, wind_dir_deg, valid_note=None):
    """Quantise + pack into a JSON-friendly dict. `wind` is a coarse grid of
    (u, v) m/s *toward* components so the browser can slant falling rain."""
    h, w = rate.shape
    scale = MAX_SIDE / max(h, w)
    if scale < 1.0:
        rate = _resample(rate, int(round(h * scale)), int(round(w * scale)))
        h, w = rate.shape
    q = np.clip(np.rint(np.sqrt(np.maximum(rate, 0.0)) * SQRT_SCALE), 0, 255).astype(np.uint8)

    ny = nx = 12
    spd = _resample(np.asarray(wind_speed_ms, dtype=np.float32), ny, nx)
    rad = np.radians(np.asarray(wind_dir_deg, dtype=np.float32))
    to = np.arctan2(_resample(np.sin(rad), ny, nx), _resample(np.cos(rad), ny, nx)) + np.pi
    u = (spd * np.sin(to)).round(2)
    v = (spd * np.cos(to)).round(2)

    wet = rate >= 0.1
    return {
        "bbox": list(bbox),
        "width": int(w),
        "height": int(h),
        "quant": SQRT_SCALE,
        "encoding": "sqrt",  # rate_mm_hr = (byte / quant) ** 2
        "rate": base64.b64encode(q.tobytes()).decode("ascii"),
        "wind": {"width": nx, "height": ny, "u": u.ravel().tolist(), "v": v.ravel().tolist()},
        "lead_minutes": int(lead_minutes),
        "source": source,
        "method": method,
        "stats": {
            "max_mm_hr": round(float(rate.max()), 1),
            "wet_fraction": round(float(wet.mean()), 4),
            "very_heavy_cells": int((rate >= 15.0).sum()),
        },
        "note": valid_note,
    }
