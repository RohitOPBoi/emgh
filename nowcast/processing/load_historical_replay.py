"""
Historical Event Replay Generator (SIH P1 Feature).

This script downloads real historical weather data (Copernicus ERA5 via Open-Meteo) 
for a specific known severe weather event and formats it as IMD ingestion snapshots.
This allows the React Dashboard's "Replay" tab to step through a real historical 
event frame-by-frame, proving the system's utility for post-event analysis.

Usage:
    python nowcast/processing/load_historical_replay.py
"""

import requests
import json
import os
import time
from datetime import datetime, timedelta

# Target Event: Delhi Extreme Downpour (June 28, 2024)
EVENT_DATE = "2024-06-28"
CENTER_LAT = 28.6139
CENTER_LON = 77.2090
GRID_SIZE = 5 # 5x5 grid = 25 stations to avoid rate limits
LAT_SPAN = 0.5 # +/- 0.5 degrees
LON_SPAN = 0.5 # +/- 0.5 degrees

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def fetch_grid_data():
    print(f"Fetching real ERA5 historical data for {EVENT_DATE} around ({CENTER_LAT}, {CENTER_LON})...")
    
    lats = [CENTER_LAT - LAT_SPAN/2 + i * (LAT_SPAN / max(1, GRID_SIZE - 1)) for i in range(GRID_SIZE)]
    lons = [CENTER_LON - LON_SPAN/2 + i * (LON_SPAN / max(1, GRID_SIZE - 1)) for i in range(GRID_SIZE)]
    
    stations = []
    station_idx = 1
    
    for lat in lats:
        for lon in lons:
            # Open-Meteo free historical API
            url = "https://archive-api.open-meteo.com/v1/archive"
            params = {
                "latitude": lat,
                "longitude": lon,
                "start_date": EVENT_DATE,
                "end_date": EVENT_DATE,
                "hourly": "precipitation,cape", # CAPE = Convective Available Potential Energy (Thunderstorm indicator)
                "timezone": "UTC"
            }
            
            try:
                resp = requests.get(url, params=params, timeout=10)
                resp.raise_for_status()
                data = resp.json()
                
                stations.append({
                    "station_id": f"DEL_HIST_{station_idx:03d}",
                    "lat": lat,
                    "lon": lon,
                    "times": data["hourly"]["time"],
                    "precip": data["hourly"]["precipitation"],
                    "cape": data["hourly"]["cape"]
                })
                station_idx += 1
                time.sleep(0.2) # Be nice to the free API
            except Exception as e:
                print(f"Failed to fetch station {station_idx}: {e}")
                
    return stations

def generate_snapshots(stations):
    if not stations:
        return
        
    imd_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "imd")
    ensure_dir(imd_dir)
    
    # Times are identical across stations, 24 hours (0 to 23)
    times = stations[0]["times"]
    
    for i, t_str in enumerate(times):
        # Format Open-Meteo time (2024-06-28T00:00) to our timestamp (20240628T000000Z)
        dt = datetime.strptime(t_str, "%Y-%m-%dT%H:%M")
        ts_id = dt.strftime("%Y%m%dT%H%M%SZ")
        
        records = []
        for st in stations:
            precip = st["precip"][i] if st["precip"][i] is not None else 0
            cape = st["cape"][i] if st["cape"][i] is not None else 0
            
            # Physics proxies based on ERA5 data:
            # High CAPE (>1000) + Rain = High probability of lightning/severe convection
            lightning_prob = 0.0
            if cape > 1500 and precip > 2:
                lightning_prob = 0.85 # High severity
            elif cape > 800 and precip > 0:
                lightning_prob = 0.40 # Moderate severity
                
            # Hail proxy: Extreme CAPE + Heavy rain
            hail_flag = bool(cape > 2000 and precip > 10)
            
            records.append({
                "station_id": st["station_id"],
                "name": f"Hist_Station_{st['station_id']}",
                "lat": round(st["lat"], 3),
                "lon": round(st["lon"], 3),
                "temperature_c": 25.0, # Placeholder, only hazards used in replay
                "humidity_pct": 90.0,
                "wind_speed_ms": 5.0,
                "pressure_hpa": 1000.0,
                "lightning_prob": lightning_prob,
                "hail_flag": hail_flag,
                "rainrate_mm_hr": precip # Note: Replay page focuses on hail/lightning
            })
            
        snapshot = {
            "timestamp": ts_id,
            "source": "open-meteo-historical-era5",
            "records": records
        }
        
        out_path = os.path.join(imd_dir, f"{ts_id}.json")
        with open(out_path, "w") as f:
            json.dump(snapshot, f, indent=2)
            
    print(f"\nSuccess! Generated 24 historical hourly snapshots for {EVENT_DATE}.")
    print("Open the 'Replay' tab in the dashboard to step through the event.")

if __name__ == "__main__":
    stations = fetch_grid_data()
    generate_snapshots(stations)
