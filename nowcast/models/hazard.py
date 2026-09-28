"""Rule-based hazard derivation (section 4c of project.md).

Deliberately not a trained classifier: no labeled hail/downburst ground
truth exists at hackathon timescale, and thresholds are explainable to
judges.

`classify_station` covers hail/lightning from the IMD nowcast feed alone
(2a) — used for the per-station panel. `hail_cells` and `downburst_cells`
below are grid-based, operating on a fused multi-channel raster
(`nowcast.processing.fusion`), and implement the actual thresholds from the
plan: hail needs reflectivity + cold cloud top + elevated lightning all
collocated; downburst needs a real radial-velocity couplet, which is why it
only exists in this grid form (not derivable from the IMD point feed, and
not derivable from a PNG radar overlay fallback either).
"""
import numpy as np

from nowcast.configs.settings import (
    LIGHTNING_PROB_HIGH,
    HAIL_REFLECTIVITY_MIN_DBZ,
    HAIL_COLD_TOP_MAX_K,
    HAIL_LIGHTNING_PROB_MIN,
    DOWNBURST_VELOCITY_DELTA_MS,
)


def classify_station(record: dict) -> dict:
    lightning_prob = record.get("lightning_prob", 0.0)
    hail_flag = record.get("hail_flag", False)

    hazards = []
    if hail_flag and lightning_prob >= LIGHTNING_PROB_HIGH:
        hazards.append({"type": "hail", "severity": "high"})
    elif hail_flag:
        hazards.append({"type": "hail", "severity": "moderate"})

    if lightning_prob >= LIGHTNING_PROB_HIGH:
        hazards.append({"type": "lightning", "severity": "high"})
    elif lightning_prob >= 0.30:
        hazards.append({"type": "lightning", "severity": "moderate"})

    # downburst: requires radar radial-velocity couplet — not available from
    # the IMD point feed, only from the gridded radar layer (see
    # `downburst_cells` below). cloudburst: requires pySTEPS rain-rate
    # extrapolation (section 4a, see `pysteps_baseline.cloudburst_cells`).

    return {**record, "hazards": hazards}


def _grid_lonlat(bbox, grid_size):
    lon_min, lat_min, lon_max, lat_max = bbox
    lons = np.linspace(lon_min, lon_max, grid_size)
    lats = np.linspace(lat_min, lat_max, grid_size)
    return lons, lats


def hail_cells(fused_frame: dict) -> list:
    """Grid cells meeting the hail rule (4c): reflectivity core AND cold
    cloud top AND elevated lightning, all collocated on the fusion grid."""
    ch = fused_frame["channels"]
    mask = (
        (ch["reflectivity_dbz"] >= HAIL_REFLECTIVITY_MIN_DBZ)
        & (ch["tir1"] <= HAIL_COLD_TOP_MAX_K)
        & (ch["lightning_prob"] >= HAIL_LIGHTNING_PROB_MIN)
    )
    lons, lats = _grid_lonlat(fused_frame["bbox"], fused_frame["grid_size"])
    ys, xs = np.where(mask)
    return [
        {
            "lat": float(lats[y]),
            "lon": float(lons[x]),
            "reflectivity_dbz": round(float(ch["reflectivity_dbz"][y, x]), 1),
            "tir1_k": round(float(ch["tir1"][y, x]), 1),
        }
        for y, x in zip(ys, xs)
    ]


def downburst_cells(fused_frame: dict) -> list:
    """Grid cells meeting the downburst rule (4c): a radial-velocity couplet
    (local inbound/outbound delta) exceeding threshold, only computable
    where real radar radial velocity exists."""
    from scipy.ndimage import maximum_filter, minimum_filter

    ch = fused_frame["channels"]
    if "velocity_ms" not in ch:
        return []
    v = ch["velocity_ms"]
    window = 5  # couplet spatial scale, grid cells
    local_max = maximum_filter(v, size=window)
    local_min = minimum_filter(v, size=window)
    delta = local_max - local_min
    mask = delta >= DOWNBURST_VELOCITY_DELTA_MS

    lons, lats = _grid_lonlat(fused_frame["bbox"], fused_frame["grid_size"])
    ys, xs = np.where(mask)
    return [
        {
            "lat": float(lats[y]),
            "lon": float(lons[x]),
            "velocity_delta_ms": round(float(delta[y, x]), 1),
        }
        for y, x in zip(ys, xs)
    ]
