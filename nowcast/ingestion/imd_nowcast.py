"""Live weather/station nowcast puller for MeghDrishti.

Writes normalized JSON to data/imd/<timestamp>.json.

The output schema is kept compatible with the existing MeghDrishti
pipeline:

{
    station_id,
    name,
    lat,
    lon,
    timestamp,
    ts_severity,
    lightning_prob_cat,
    lightning_prob,
    hail_flag,
    temperature,
    humidity,
    wind_speed,
    wind_direction,
    precipitation_intensity,
    precipitation_probability,
    weather_code,
    source
}

Live source:
    Tomorrow.io Realtime Weather API

Environment:
    TOMORROW_API_KEY=<your API key>

If the live API is unavailable, the pipeline falls back to the
existing synthetic/mock feed so the rest of the project remains runnable.
"""

import json
import math
import os
import random
import sys
from datetime import datetime, timezone

import requests

sys.path.insert(
    0,
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
)

from nowcast.configs.settings import (
    get_region_bbox,
    get_region_name,
    get_active_region_key,
    IMD_DIR,
    USE_LIVE_IMD,
    TOMORROW_API_KEY,
    USE_LIVE_LIGHTNING,
)

from nowcast.processing.storm_track import center_at


# ---------------------------------------------------------------------------
# Demo stations — six AWS-style points spread around whichever region is
# active (settings.set_active_region), same relative layout (km offsets from
# region center) the original hardcoded Pune stations used. Regenerated on
# every call rather than a static list so switching regions doesn't leave
# stale station names/coordinates from the previous city.
# ---------------------------------------------------------------------------

_STATION_OFFSETS = [
    ("001", "City", 2.2, 2.7),
    ("002", "North Metro", 14.5, -3.2),
    ("003", "Hills AWS", 28.0, -24.5),
    ("004", "East Outskirts", -16.5, 51.0),
    ("005", "Reservoir AWS", -9.0, -7.0),
    ("006", "Storm-adjacent AWS", -20.0, -18.0),
]


def get_stations():
    lon_min, lat_min, lon_max, lat_max = get_region_bbox()
    center_lat, center_lon = (lat_min + lat_max) / 2, (lon_min + lon_max) / 2
    region_key = get_active_region_key()
    region_name = get_region_name()

    km_per_deg_lat = 111.0
    km_per_deg_lon = 111.0 * math.cos(math.radians(center_lat))

    stations = []
    for suffix, label, dlat_km, dlon_km in _STATION_OFFSETS:
        stations.append(
            {
                "station_id": f"{region_key.upper()[:3]}{suffix}",
                "name": f"{region_name} {label}",
                "lat": round(center_lat + dlat_km / km_per_deg_lat, 4),
                "lon": round(center_lon + dlon_km / km_per_deg_lon, 4),
            }
        )
    return stations


# ---------------------------------------------------------------------------
# Existing lightning categories retained for compatibility
# with downstream MeghDrishti code.
# ---------------------------------------------------------------------------

LIGHTNING_CATS = {
    "cat6": 0.15,
    "cat11": 0.45,
    "cat19": 0.75,
}


# ---------------------------------------------------------------------------
# Existing synthetic storm helper
# ---------------------------------------------------------------------------

def _km_from_storm_core(lat, lon, t_min=0):
    """Calculate approximate distance from the synthetic storm core."""

    c_lat, c_lon = center_at(t_min)

    km_per_deg_lat = 111.0
    km_per_deg_lon = 111.0 * math.cos(math.radians(c_lat))

    dy = (lat - c_lat) * km_per_deg_lat
    dx = (lon - c_lon) * km_per_deg_lon

    return math.hypot(dx, dy)


# ---------------------------------------------------------------------------
# Tomorrow.io live ingestion
# ---------------------------------------------------------------------------

def _fetch_live():
    """Fetch realtime weather observations from Tomorrow.io.

    The function converts Tomorrow.io's response into the normalized
    MeghDrishti station schema used by the rest of the pipeline.

    Returns:
        list[dict]: Normalized weather records.

    Raises:
        RuntimeError: If the API key is missing or rate limiting occurs.
        requests.RequestException: If an API request fails.
    """

    if not TOMORROW_API_KEY:
        raise RuntimeError(
            "TOMORROW_API_KEY is not configured. "
            "Add it to the .env file."
        )

    url = "https://api.tomorrow.io/v4/weather/realtime"

    records = []

    for station in get_stations():
        params = {
            "location": f"{station['lat']},{station['lon']}",
            "apikey": TOMORROW_API_KEY,
        }

        response = requests.get(
            url,
            params=params,
            timeout=15,
        )

        # ---------------------------------------------------------------
        # Handle Tomorrow.io rate limiting explicitly.
        # ---------------------------------------------------------------

        if response.status_code == 429:
            raise RuntimeError(
                "Tomorrow.io rate limit reached (HTTP 429). "
                "Wait for the current rate-limit window to reset "
                "before requesting live weather data again."
            )

        # Raise an exception for other HTTP 4xx/5xx responses.
        response.raise_for_status()

        payload = response.json()

        data = payload.get("data", {})
        values = data.get("values", {})

        # ---------------------------------------------------------------
        # Real weather values from Tomorrow.io
        # ---------------------------------------------------------------

        temperature = values.get("temperature")
        humidity = values.get("humidity")
        wind_speed = values.get("windSpeed")
        wind_direction = values.get("windDirection")

        precipitation_intensity = values.get(
            "precipitationIntensity"
        )

        precipitation_probability = values.get(
            "precipitationProbability"
        )

        weather_code = values.get("weatherCode")

        observation_time = data.get("time")

        if not observation_time:
            observation_time = datetime.now(
                timezone.utc
            ).isoformat()

        # ---------------------------------------------------------------
        # Derive thunderstorm severity from precipitation intensity.
        #
        # This is a compatibility mapping for the existing schema.
        # It is NOT a claim that precipitation alone proves a
        # thunderstorm.
        # ---------------------------------------------------------------

        if precipitation_intensity is None:
            thunderstorm_severity = "nil"

        elif precipitation_intensity >= 10:
            thunderstorm_severity = "widespread"

        elif precipitation_intensity >= 2:
            thunderstorm_severity = "scattered"

        elif precipitation_intensity > 0:
            thunderstorm_severity = "isolated"

        else:
            thunderstorm_severity = "nil"

        # ---------------------------------------------------------------
        # Lightning
        #
        # The Tomorrow.io realtime response available to this project
        # does not expose a lightning field.
        #
        # IMPORTANT:
        # precipitationProbability is NOT the same as lightning
        # probability, so we do NOT map it to lightning_prob.
        #
        # The existing lightning fields are retained only to preserve
        # compatibility with the downstream MeghDrishti pipeline.
        # ---------------------------------------------------------------

        lightning_prob = 0.0
        lightning_prob_cat = "cat6"

        # ---------------------------------------------------------------
        # Hail flag
        #
        # We do not infer hail from precipitation alone.
        # Existing schema is preserved, but live hail detection is
        # disabled until a suitable hail-capable source/model is added.
        # ---------------------------------------------------------------

        hail_flag = False

        # ---------------------------------------------------------------
        # Normalized record
        # ---------------------------------------------------------------

        record = {
            "station_id": station["station_id"],
            "name": station["name"],
            "lat": station["lat"],
            "lon": station["lon"],
            "timestamp": observation_time,

            # Existing MeghDrishti fields
            "ts_severity": thunderstorm_severity,
            "lightning_prob_cat": lightning_prob_cat,
            "lightning_prob": lightning_prob,
            "hail_flag": hail_flag,

            # Real Tomorrow.io weather observations
            "temperature": temperature,
            "humidity": humidity,
            "wind_speed": wind_speed,
            "wind_direction": wind_direction,
            "precipitation_intensity": precipitation_intensity,
            "precipitation_probability": precipitation_probability,
            "weather_code": weather_code,

            # Source tracking
            "source": "tomorrow.io",
        }

        records.append(record)

    return records


# ---------------------------------------------------------------------------
# Real lightning overlay (Blitzortung) — independent of USE_LIVE_IMD, applies
# on top of whichever station-data source (live Tomorrow.io or mock) is
# active, since neither of those has a real lightning field.
# ---------------------------------------------------------------------------

def _apply_live_lightning(records):
    """Overwrite each record's lightning_prob/_cat with real Blitzortung strikes.

    Proximity-decay from the nearest real strike seen in the listen window,
    same functional form as the mock generator's storm-proximity weighting
    so hazard thresholds (settings.py) stay meaningful either way. Zero
    strikes nearby is a normal result (no storm right now), not an error —
    it correctly zeroes out lightning_prob rather than leaving a stale mock
    value in place.
    """
    from nowcast.ingestion.blitzortung_lightning import fetch_strikes

    strikes = fetch_strikes()

    for record in records:
        if not strikes:
            prob = 0.0
        else:
            km_per_deg_lat = 111.0
            km_per_deg_lon = 111.0 * math.cos(math.radians(record["lat"]))
            nearest_km = min(
                math.hypot(
                    (record["lat"] - s["lat"]) * km_per_deg_lat,
                    (record["lon"] - s["lon"]) * km_per_deg_lon,
                )
                for s in strikes
            )
            prob = math.exp(-(nearest_km**2) / (2 * 15.0**2))

        record["lightning_prob"] = round(prob, 3)
        record["lightning_prob_cat"] = "cat19" if prob >= 0.75 else "cat11" if prob >= 0.45 else "cat6"
        record["lightning_source"] = "blitzortung"

    return records


# ---------------------------------------------------------------------------
# Existing mock/replay ingestion
# ---------------------------------------------------------------------------

def _fetch_mock():
    """Generate the existing synthetic weather/storm feed.

    This remains as a fallback so MeghDrishti can still run when the
    live weather API is unavailable.
    """

    now = datetime.now(timezone.utc).isoformat()

    records = []

    for station in get_stations():
        dist_km = _km_from_storm_core(
            station["lat"],
            station["lon"],
        )

        proximity = math.exp(
            -(dist_km ** 2) / (2 * 15.0 ** 2)
        )

        if proximity > 0.6:
            weights = [
                0.05,
                0.25,
                0.70,
            ]

        elif proximity > 0.2:
            weights = [
                0.20,
                0.50,
                0.30,
            ]

        else:
            weights = [
                0.70,
                0.25,
                0.05,
            ]

        cat = random.choices(
            list(LIGHTNING_CATS.keys()),
            weights=weights,
        )[0]

        severity = random.choice(
            [
                "nil",
                "isolated",
                "scattered",
                "widespread",
            ]
        )

        hail_flag = (
            cat == "cat19"
            and random.random()
            < (
                0.6
                if proximity > 0.6
                else 0.1
            )
        )

        records.append(
            {
                "station_id": station["station_id"],
                "name": station["name"],
                "lat": station["lat"],
                "lon": station["lon"],
                "timestamp": now,

                "ts_severity": severity,
                "lightning_prob_cat": cat,
                "lightning_prob": LIGHTNING_CATS[cat],
                "hail_flag": hail_flag,

                "source": "mock-replay",
            }
        )

    return records


# ---------------------------------------------------------------------------
# Main ingestion function
# ---------------------------------------------------------------------------

def pull():
    """Fetch weather data and write normalized JSON to the data directory."""

    os.makedirs(
        IMD_DIR,
        exist_ok=True,
    )

    try:
        if USE_LIVE_IMD:
            records = _fetch_live()

        else:
            records = _fetch_mock()

    except RuntimeError as exc:
        print(
            f"[imd_nowcast] live fetch unavailable ({exc}), "
            "falling back to mock",
            file=sys.stderr,
        )

        records = _fetch_mock()

    except requests.RequestException as exc:
        print(
            f"[imd_nowcast] live request failed ({exc}), "
            "falling back to mock",
            file=sys.stderr,
        )

        records = _fetch_mock()

    except Exception as exc:
        print(
            f"[imd_nowcast] unexpected live fetch error ({exc}), "
            "falling back to mock",
            file=sys.stderr,
        )

        records = _fetch_mock()

    if USE_LIVE_LIGHTNING:
        try:
            records = _apply_live_lightning(records)
        except Exception as exc:
            print(
                f"[imd_nowcast] live lightning fetch failed ({exc}), "
                "keeping existing lightning fields",
                file=sys.stderr,
            )

    timestamp = datetime.now(
        timezone.utc
    ).strftime(
        "%Y%m%dT%H%M%SZ"
    )

    out_path = os.path.join(
        IMD_DIR,
        f"{timestamp}.json",
    )

    with open(
        out_path,
        "w",
        encoding="utf-8",
    ) as output_file:

        json.dump(
            {
                "bbox": get_region_bbox(),
                "records": records,
            },
            output_file,
            indent=2,
        )

    print(
        f"[imd_nowcast] wrote "
        f"{len(records)} records -> {out_path}"
    )

    return out_path


# ---------------------------------------------------------------------------
# Script entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    pull()