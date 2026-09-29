import { X, Box } from "lucide-react";
import type { AreaForecast, Bbox } from "../types";

export type AreaVarId = "none" | "temperature" | "humidity" | "wind_speed" | "pressure";

const VARS: { id: AreaVarId; label: string }[] = [
  { id: "none", label: "NONE" },
  { id: "temperature", label: "TEMP" },
  { id: "humidity", label: "HUMID" },
  { id: "wind_speed", label: "WIND" },
  { id: "pressure", label: "PRESS" },
];

function statRow(
  label: string,
  unit: string,
  stat: { min: number; mean: number; max: number } | null | undefined,
  loading: boolean,
  highlighted: boolean
) {
  return (
    <div
      className="hazard-stat"
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid var(--line)",
        padding: "6px 8px",
        background: highlighted ? "var(--surface-3)" : "transparent",
        borderRadius: "var(--r-chip)",
      }}
    >
      <span className="lbl">{label}</span>
      <span className="val mono" style={{ fontSize: 11 }}>
        {stat ? `${stat.min}–${stat.max}${unit} (AVG ${stat.mean}${unit})` : loading ? "CALCULATING…" : "—"}
      </span>
    </div>
  );
}

export function AreaFloating({
  bbox,
  reading,
  loading,
  error,
  leadMinutes,
  onLeadChange,
  hazardCount,
  areaVar,
  onAreaVarChange,
  onClose,
}: {
  bbox: Bbox;
  reading: AreaForecast | null;
  loading: boolean;
  error: string | null;
  leadMinutes: number;
  onLeadChange: (m: number) => void;
  hazardCount: number;
  areaVar: AreaVarId;
  onAreaVarChange: (v: AreaVarId) => void;
  onClose: () => void;
}) {
  const leadLabel = leadMinutes === 0 ? "NOW" : `+${Math.floor(leadMinutes / 60)}h ${leadMinutes % 60 ? `${leadMinutes % 60}m` : ""}`;
  const [lonMin, latMin, lonMax, latMax] = bbox;
  const widthKm = Math.round((lonMax - lonMin) * 111 * Math.cos(((latMin + latMax) / 2) * (Math.PI / 180)));
  const heightKm = Math.round((latMax - latMin) * 111);

  return (
    <div className="region-floating panel" role="dialog" aria-label="Area Bounding Box Inspection">
      <div className="drawer-head">
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Box size={13} style={{ color: "var(--text-3)" }} />
          <h2>Sector Analysis</h2>
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
          }}
        >
          {latMin.toFixed(2)}–{latMax.toFixed(2)}°N, {lonMin.toFixed(2)}–{lonMax.toFixed(2)}°E (~{widthKm}×{heightKm}KM)
        </div>

        <div>
          <div className="label mono" style={{ marginBottom: 5 }}>
            MAP RASTER VARIABLE
          </div>
          <div className="seg" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", width: "100%", padding: 2 }}>
            {VARS.map((v) => (
              <button
                key={v.id}
                aria-pressed={areaVar === v.id}
                onClick={() => onAreaVarChange(v.id)}
                style={{ fontSize: 9.5, padding: "4px 0", justifyContent: "center" }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="label mono" style={{ color: "var(--high)", marginTop: 2 }}>
            FETCH ERROR: {error}
          </div>
        )}
        {loading && !reading && (
          <div className="label mono" style={{ marginTop: 2 }}>
            AGGREGATING SATELLITE/RADAR TENSORS…
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {statRow("TEMPERATURE", "°C", reading?.temperature_c, loading, areaVar === "temperature")}
          {statRow("HUMIDITY", "%", reading?.humidity_pct, loading, areaVar === "humidity")}
          {statRow("WIND SPEED", "m/s", reading?.wind_speed_ms, loading, areaVar === "wind_speed")}
          {statRow("PRESSURE", "hPa", reading?.pressure_hpa, loading, areaVar === "pressure")}
          <div
            className="hazard-stat"
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid var(--line)",
              padding: "6px 8px",
            }}
          >
            <span className="lbl">Cloudburst Peak</span>
            <span className="val mono" style={{ fontSize: 11, color: "var(--radar-3)" }}>
              {reading
                ? reading.cloudburst_rainrate_mm_hr === null
                  ? "N/A"
                  : `${reading.cloudburst_rainrate_mm_hr.min}–${reading.cloudburst_rainrate_mm_hr.max} mm/hr`
                : loading
                ? "…"
                : "—"}
            </span>
          </div>
          <div
            className="hazard-stat"
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 8px",
            }}
          >
            <span className="lbl">Active Cells</span>
            <span className="val mono" style={{ fontSize: 11, color: hazardCount > 0 ? "var(--high)" : "var(--text)" }}>
              {hazardCount}
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
            aria-label="Area lead time slider"
          />
        </div>
      </div>
    </div>
  );
}
