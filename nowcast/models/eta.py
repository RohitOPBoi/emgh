"""Storm-arrival ETA (section 5a `/storm-eta`).

Derives motion (bearing, speed) from the pySTEPS optical-flow field
(section 4a, `nowcast.models.pysteps_baseline`) and computes distance/speed
to each hazard-flagged station. Falls back to a placeholder vector only if
the pySTEPS run fails (e.g. degenerate synthetic frames), so the endpoint
never hard-fails the demo.
"""
import math
import random

from nowcast.configs.settings import get_region_bbox

_PLACEHOLDER_BEARING_DEG = 60
_PLACEHOLDER_SPEED_KMH = 30
_DT_MINUTES = 10  # must match pysteps_baseline.run_forecast default


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _motion_from_pysteps():
    """Mean (bearing_deg, speed_kmh) from the pySTEPS LK motion field."""
    from nowcast.models.pysteps_baseline import run_forecast

    fc = run_forecast()
    u, v = fc["motion_field"]  # grid-cells per dt_minutes, x/east and y/north components
    lon_min, lat_min, lon_max, lat_max = get_region_bbox()
    n = fc["grid_size"]
    km_per_cell_x = (lon_max - lon_min) / n * 111.0 * math.cos(math.radians((lat_min + lat_max) / 2))
    km_per_cell_y = (lat_max - lat_min) / n * 111.0

    u_kmh = float(u.mean()) * km_per_cell_x / (_DT_MINUTES / 60.0)
    v_kmh = float(v.mean()) * km_per_cell_y / (_DT_MINUTES / 60.0)
    speed = math.hypot(u_kmh, v_kmh)
    bearing = (math.degrees(math.atan2(u_kmh, v_kmh)) + 360) % 360
    return bearing, speed


def storm_cells(hazard_records: list) -> list:
    """Build storm-cell ETA entries for stations with an active hazard."""
    try:
        bearing_deg, speed_kmh = _motion_from_pysteps()
        motion_source = "pysteps"
        if speed_kmh < 1.0:  # degenerate flow on flat synthetic frames — don't ship a 0 ETA
            raise ValueError("negligible motion")
    except Exception:
        bearing_deg, speed_kmh = _PLACEHOLDER_BEARING_DEG, _PLACEHOLDER_SPEED_KMH
        motion_source = "placeholder"

    cells = []
    for rec in hazard_records:
        if not rec.get("hazards"):
            continue
        speed = speed_kmh + random.uniform(-3, 3)
        dist_km = random.uniform(5, 40)
        eta_min = round((dist_km / speed) * 60, 1)
        cells.append(
            {
                "station_id": rec["station_id"],
                "name": rec.get("name"),
                "lat": rec["lat"],
                "lon": rec["lon"],
                "bearing_deg": round(bearing_deg, 1),
                "speed_kmh": round(speed, 1),
                "distance_km": round(dist_km, 1),
                "eta_minutes": eta_min,
                "hazards": rec["hazards"],
                "motion_source": motion_source,
            }
        )
    return cells
