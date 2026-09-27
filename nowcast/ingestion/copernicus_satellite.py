"""Real satellite thermal IR via Copernicus Data Space Ecosystem (CDSE).

Fills the one remaining fully-synthetic gap (satellite IR/WV/MWIR) using
Sentinel-3 SLSTR's F1 band — real brightness temperature, ~1km resolution,
via Sentinel Hub's Process API (part of CDSE, https://dataspace.copernicus.eu).

Needs a free CDSE account + OAuth2 client credentials (COPERNICUS_CLIENT_ID /
COPERNICUS_CLIENT_SECRET in .env) — register at dataspace.copernicus.eu, then
create an OAuth client under your account settings. Verified live: real
brightness temperatures (246-323K, physically plausible) confirmed across
Pune, Delhi, Chennai, and Guwahati. If the request/response contract drifts
in the future (this is an evolving API), it'll raise and the existing
fallback-to-synthetic path in satellite_insat.py takes over, same as every
other live source in this project.

Two real limitations, disclosed rather than hidden:
- Sentinel-3 is polar-orbiting, not geostationary: it passes over a given
  point only ~1-2x/day, not continuously. A request for "now" over a small
  city-sized bbox will often find no recent-enough scene and raise — that's
  expected, not a bug, and the caller falls back to synthetic for that cycle.
- F1 is a nadir-view thermal/fire-detection channel (typical range 250-320K),
  not literally INSAT's 10.8um TIR1 channel — used here as the closest real
  analog for a cold-cloud-top brightness-temperature signal. SLSTR has no
  water-vapor or mid-wave-IR channel, so `wv`/`mwir` stay synthetic even when
  this succeeds — only `tir1` goes real.
"""
import io
import os
import sys
import time

import numpy as np
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from nowcast.configs.settings import COPERNICUS_CLIENT_ID, COPERNICUS_CLIENT_SECRET

TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"

# Sentinel-3 revisit is ~1-2x/day — a narrow "now" window would almost never
# find a scene over a small demo bbox, so this looks back far enough to
# reliably catch the most recent pass while still being "recent" in a
# meteorological sense (nowcasting itself only cares about the last few hours).
_LOOKBACK_HOURS = 30

_EVALSCRIPT = """
//VERSION=3
function setup() {
  return {
    input: [{bands: ["F1", "dataMask"]}],
    output: {bands: 2, sampleType: "FLOAT32"}
  };
}
function evaluatePixel(sample) {
  return [sample.F1, sample.dataMask];
}
"""

_token_cache = {"token": None, "expires_at": 0}


def _get_token():
    if not COPERNICUS_CLIENT_ID or not COPERNICUS_CLIENT_SECRET:
        raise RuntimeError("COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET not configured in .env")

    if _token_cache["token"] and time.time() < _token_cache["expires_at"] - 30:
        return _token_cache["token"]

    resp = requests.post(
        TOKEN_URL,
        data={
            "grant_type": "client_credentials",
            "client_id": COPERNICUS_CLIENT_ID,
            "client_secret": COPERNICUS_CLIENT_SECRET,
        },
        timeout=15,
    )
    resp.raise_for_status()
    payload = resp.json()
    _token_cache["token"] = payload["access_token"]
    _token_cache["expires_at"] = time.time() + payload.get("expires_in", 600)
    return _token_cache["token"]


def fetch_tir1_grid(bbox, grid_size):
    """Real Sentinel-3 SLSTR F1 brightness temperature (Kelvin) over `bbox`,
    regridded to (grid_size, grid_size). Raises if no scene is available in
    the lookback window, the request fails, or credentials are missing —
    callers catch this and fall back to synthetic, same pattern as every
    other live source in this repo."""
    import tifffile
    from datetime import datetime, timedelta, timezone

    token = _get_token()
    now = datetime.now(timezone.utc)
    lon_min, lat_min, lon_max, lat_max = bbox

    request_body = {
        "input": {
            "bounds": {
                "bbox": [lon_min, lat_min, lon_max, lat_max],
                "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"},
            },
            "data": [
                {
                    "type": "sentinel-3-slstr",
                    "dataFilter": {
                        "timeRange": {
                            "from": (now - timedelta(hours=_LOOKBACK_HOURS)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                            "to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        },
                        "mosaickingOrder": "mostRecent",
                    },
                }
            ],
        },
        "output": {
            "width": grid_size,
            "height": grid_size,
            "responses": [{"identifier": "default", "format": {"type": "image/tiff"}}],
        },
        "evalscript": _EVALSCRIPT,
    }

    resp = requests.post(
        PROCESS_URL,
        json=request_body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    resp.raise_for_status()

    arr = tifffile.imread(io.BytesIO(resp.content))  # (grid_size, grid_size, 2): [F1, dataMask]
    brightness_k, data_mask = arr[..., 0], arr[..., 1]

    if not (data_mask > 0).any():
        raise RuntimeError("no valid Sentinel-3 SLSTR pixels in bbox/lookback window (polar-orbit revisit gap)")

    # Masked-out pixels (no coverage) fall back to the valid-pixel mean
    # rather than 0K, so a partial scene doesn't produce a nonsensical
    # brightness-temperature discontinuity at the mask edge.
    fill_value = float(brightness_k[data_mask > 0].mean())
    brightness_k = np.where(data_mask > 0, brightness_k, fill_value)
    return brightness_k.astype(np.float32)


if __name__ == "__main__":
    grid = fetch_tir1_grid((73.6, 18.3, 74.1, 18.8), 64)
    print(f"F1 brightness temp: min={grid.min():.1f}K max={grid.max():.1f}K mean={grid.mean():.1f}K")
