"""Real satellite thermal IR via EUMETSAT Data Store + Data Tailor.

Continuous-coverage alternative to copernicus_satellite.py (Sentinel-3,
polar-orbiting): MSG SEVIRI (`EO:EUM:DAT:MSG:HRSEVIRI`) is geostationary and
actually centered on the Indian Ocean/India region, updating every 15
minutes, vs Sentinel-3's ~1-2 passes/day. Uses the official `eumdac`
package (EUMETSAT's own Python client) rather than reimplementing its
OAuth2 + OpenSearch + Data Tailor job API by hand.

Needs a free EUMETSAT account + API credentials (EUMETSAT_CONSUMER_KEY /
EUMETSAT_CONSUMER_SECRET in .env) — register at user.eumetsat.int, then
generate a consumer key/secret at api.eumetsat.int/api-key (NOT your
account login password).

STATUS: tested against live credentials (auth + collection search both
confirmed working), but currently blocked by EUMETSAT-side licensing, not
a code bug. Both direct Data Store download and Data Tailor customisation
return `403 Unauthorised` even after accepting the "Meteosat < 1 hr
latency" (Educational/Research) license in the EUMETSAT portal — most
likely a propagation delay between the portal's license-acceptance action
and API-level entitlement, since HRSEVIRI is specifically the <1hr-latency
product. One real bug was found and fixed in testing: `RegionOfInterest`'s
`NSWE` field is typed `Optional[str]` but the API actually rejects a
comma-joined string ("must be a list of 4 values") — it needs a plain
list of floats, which is what's used below. Falls back to
copernicus_satellite.py (verified fully working) until the 403 clears.
Two more things remain unverified until it actually succeeds once:
- Whether Data Tailor's GeoTIFF export for HRSEVIRI is already-calibrated
  brightness temperature or needs an extra calibration/filter step.
- The exact channel ordering in the exported GeoTIFF — assumed to match
  SEVIRI's standard 12-channel order (VIS0.6, VIS0.8, NIR1.6, IR3.9, WV6.2,
  WV7.3, IR8.7, IR9.7, IR10.8, IR12.0, IR13.4, HRV), i.e. IR10.8 at band
  index 8 (0-indexed) — `IR108_BAND_INDEX` below.
Data Tailor jobs are also asynchronous (queued -> running -> done), so a
single fetch can genuinely take 30s-2min, much slower than
copernicus_satellite.py's synchronous Process API call.
"""
import io
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import numpy as np
import tifffile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from nowcast.configs.settings import EUMETSAT_CONSUMER_KEY, EUMETSAT_CONSUMER_SECRET

COLLECTION_ID = "EO:EUM:DAT:MSG:HRSEVIRI"
IR108_BAND_INDEX = 8  # see module docstring — assumed standard SEVIRI channel order

_LOOKBACK_MINUTES = 45  # MSG updates every 15min; generous margin for latency
_JOB_TIMEOUT_SECONDS = 150  # Data Tailor jobs are genuinely slow (async processing)
_JOB_POLL_SECONDS = 5


def _get_token():
    import eumdac

    if not EUMETSAT_CONSUMER_KEY or not EUMETSAT_CONSUMER_SECRET:
        raise RuntimeError("EUMETSAT_CONSUMER_KEY / EUMETSAT_CONSUMER_SECRET not configured in .env")
    return eumdac.AccessToken((EUMETSAT_CONSUMER_KEY, EUMETSAT_CONSUMER_SECRET))


def fetch_ir108_grid(bbox, grid_size):
    """Real MSG SEVIRI IR10.8 brightness temperature (Kelvin) over `bbox`,
    regridded to (grid_size, grid_size). Raises on any failure (missing
    credentials, no recent product, job timeout/failure, decode error) —
    callers catch this and fall back, same pattern as every other live
    source in this repo."""
    import eumdac
    from eumdac.tailor_models import Chain, RegionOfInterest

    token = _get_token()
    datastore = eumdac.DataStore(token)
    collection = datastore.get_collection(COLLECTION_ID)

    now = datetime.now(timezone.utc)
    products = list(
        collection.search(
            dtstart=now - timedelta(minutes=_LOOKBACK_MINUTES),
            dtend=now,
        )
    )
    if not products:
        raise RuntimeError(f"no MSG HRSEVIRI product found in the last {_LOOKBACK_MINUTES} minutes")
    product = products[0]  # most recent

    lon_min, lat_min, lon_max, lat_max = bbox
    # Despite the type hint (Optional[str]), the Data Tailor API rejects a
    # comma-joined string ("ROI's 'NSWE' section must be a list of 4
    # values") — confirmed against a live 400 response. A plain list of
    # floats is what it actually wants.
    roi = RegionOfInterest(NSWE=[lat_max, lat_min, lon_min, lon_max])
    chain = Chain(product="HRSEVIRI", format="geotiff", roi=roi)

    datatailor = eumdac.DataTailor(token)
    customisation = datatailor.new_customisation(product, chain)

    try:
        deadline = time.time() + _JOB_TIMEOUT_SECONDS
        while customisation.status not in ("DONE", "FAILED", "KILLED", "INACTIVE"):
            if time.time() > deadline:
                customisation.kill()
                raise RuntimeError(f"Data Tailor job exceeded {_JOB_TIMEOUT_SECONDS}s, giving up")
            time.sleep(_JOB_POLL_SECONDS)

        if customisation.status != "DONE":
            raise RuntimeError(f"Data Tailor job ended with status {customisation.status}")

        output_name = next((o for o in customisation.outputs if o.lower().endswith((".tif", ".tiff"))), None)
        if output_name is None:
            raise RuntimeError(f"no GeoTIFF in Data Tailor outputs: {list(customisation.outputs)}")

        with customisation.stream_output(output_name) as f:
            raw_bytes = f.read()
    finally:
        customisation.delete()  # Data Tailor has a storage quota — always clean up

    arr = tifffile.imread(io.BytesIO(raw_bytes))
    if arr.ndim == 3:
        if arr.shape[-1] > IR108_BAND_INDEX:
            band = arr[..., IR108_BAND_INDEX]
        else:
            band = arr[..., 0]
    else:
        band = arr

    from scipy.ndimage import zoom

    if band.shape != (grid_size, grid_size):
        zoom_factors = (grid_size / band.shape[0], grid_size / band.shape[1])
        band = zoom(band, zoom_factors, order=1)

    return band.astype(np.float32)


if __name__ == "__main__":
    grid = fetch_ir108_grid((73.6, 18.3, 74.1, 18.8), 64)
    print(f"IR10.8 brightness temp: min={grid.min():.1f}K max={grid.max():.1f}K mean={grid.mean():.1f}K")
