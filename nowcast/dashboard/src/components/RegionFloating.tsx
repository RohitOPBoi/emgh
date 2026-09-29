import { X, Crosshair } from "lucide-react";
import { windCompass } from "../lib/colors";
import type { RegionForecast } from "../types";

export function RegionFloating({
  region,
  reading,
  leadMinutes,
  onLeadChange,
  onClose,
}: {
  region: { lat: number; lon: number };
  reading: RegionForecast | null;
  leadMinutes: number;
  onLeadChange: (m: number) => void;
  onClose: () => void;
}) {
  const leadLabel = leadMinutes === 0 ? "NOW" : `+${Math.floor(leadMinutes / 60)}h ${leadMinutes % 60 ? `${leadMinutes % 60}m` : ""}`;

  return (
    <div className="region-floating panel" role="dialog" aria-label="Point Inspection">
      <div className="drawer-head">
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Crosshair size={13} style={{ color: "var(--text-3)" }} />
          <h2>Point Telemetry</h2>
        </div>
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          <X size={13} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)", padding: "var(--s-3)" }}>
        <div
          className="tile region-coords mono"
          style={{
            padding: "6px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{region.lat.toFixed(3)}°N, {region.lon.toFixed(3)}°E</span>
            {reading?.district && (
              <span className="chip" style={{ fontSize: 9, padding: "1px 6px", background: "var(--accent-glow)", color: "var(--accent)" }}>
                {reading.district}
              </span>
            )}
          </div>
          {reading?.state && (
            <span style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {reading.state}{reading.distance_to_district_km !== undefined ? ` · ${reading.distance_to_district_km}km from HQ` : ""}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div className="hazard-stat" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", padding: "6px 8px" }}>
            <span className="lbl">Temperature</span>
            <span className="val mono">{reading ? `${reading.temperature_c}°C` : "…"}</span>
          </div>

          <div className="hazard-stat" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", padding: "6px 8px" }}>
            <span className="lbl">Humidity</span>
            <span className="val mono">{reading ? `${reading.humidity_pct}%` : "…"}</span>
          </div>

          <div className="hazard-stat" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", padding: "6px 8px" }}>
            <span className="lbl">Wind Vector</span>
            <span className="val mono">
              {reading ? `${reading.wind_speed_ms} m/s ${windCompass(reading.wind_dir_deg)}` : "…"}
            </span>
          </div>

          <div className="hazard-stat" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", padding: "6px 8px" }}>
            <span className="lbl">Surface Pressure</span>
            <span className="val mono">{reading ? `${reading.pressure_hpa} hPa` : "…"}</span>
          </div>

          <div className="hazard-stat" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: "6px 8px" }}>
            <span className="lbl">Cloudburst Risk</span>
            <span className="val mono" style={{ color: "var(--radar-3)" }}>
              {reading
                ? reading.cloudburst_rainrate_mm_hr === null
                  ? "N/A"
                  : `${reading.cloudburst_rainrate_mm_hr} mm/hr`
                : "…"}
            </span>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-3)", marginBottom: 6 }} className="mono">
            <span>TIME HORIZON</span>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{leadLabel}</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={30}
            value={leadMinutes}
            onChange={(e) => onLeadChange(parseInt(e.target.value, 10))}
            aria-label="Inspection lead time slider"
          />
        </div>
      </div>
    </div>
  );
}
