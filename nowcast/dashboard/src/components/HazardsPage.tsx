import { useMemo, useState } from "react";
import { X, AlertTriangle, ArrowUpRight } from "lucide-react";
import { HAZARD_COLOR } from "../lib/colors";
import type { HazardsResponse, HazardType, StormCell } from "../types";

interface Row {
  type: HazardType;
  severity: string;
  metricLabel: string;
  metricValue: string;
  location: string;
  lat: number;
  lon: number;
  timestamp?: string;
  etaMinutes?: number;
}

function metricFor(type: HazardType, h: { reflectivity_dbz?: number; velocity_delta_ms?: number; rainrate_mm_hr?: number }): { label: string; value: string } {
  if (type === "hail" && h.reflectivity_dbz !== undefined) return { label: "Reflectivity", value: `${h.reflectivity_dbz} dBZ` };
  if (type === "downburst" && h.velocity_delta_ms !== undefined) return { label: "Velocity delta", value: `${h.velocity_delta_ms} m/s` };
  if (type === "downburst" && h.reflectivity_dbz !== undefined) return { label: "Core (proxy)", value: `${h.reflectivity_dbz} dBZ` };
  if (type === "cloudburst" && h.rainrate_mm_hr !== undefined) return { label: "Rain rate", value: `${h.rainrate_mm_hr} mm/hr` };
  return { label: "-", value: "-" };
}

function buildRows(hazards: HazardsResponse | null, stormCells: StormCell[] | null): Row[] {
  if (!hazards) return [];
  const rows: Row[] = [];
  for (const f of hazards.features) {
    const [lon, lat] = f.geometry.coordinates;
    for (const h of f.properties.hazards) {
      const near = h.district ? `${h.district}${h.state ? `, ${h.state}` : ""}` : "";
      const location =
        f.properties.name || f.properties.station_id || near || `${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`;
      const metric = metricFor(h.type, h);
      const matchingCell = f.properties.station_id
        ? (stormCells ?? []).find((c) => c.station_id === f.properties.station_id && c.hazards.some((ch) => ch.type === h.type))
        : undefined;
      rows.push({
        type: h.type,
        severity: h.severity,
        metricLabel: metric.label,
        metricValue: metric.value,
        location,
        lat,
        lon,
        timestamp: f.properties.timestamp,
        etaMinutes: matchingCell?.eta_minutes,
      });
    }
  }
  return rows.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
    if (a.etaMinutes !== undefined && b.etaMinutes !== undefined) return a.etaMinutes - b.etaMinutes;
    return a.type.localeCompare(b.type);
  });
}

const ALL_TYPES: HazardType[] = ["hail", "lightning", "cloudburst", "downburst"];

export function HazardsPage({
  hazards,
  stormCells,
  onClose,
  onSelectLocation,
}: {
  hazards: HazardsResponse | null;
  stormCells: StormCell[] | null;
  onClose: () => void;
  onSelectLocation: (lat: number, lon: number) => void;
}) {
  const [filter, setFilter] = useState<HazardType | "all">("all");
  const rows = useMemo(() => buildRows(hazards, stormCells), [hazards, stormCells]);
  const visibleRows = filter === "all" ? rows : rows.filter((r) => r.type === filter);
  const counts = useMemo(() => {
    const c: Record<string, number> = { hail: 0, downburst: 0, cloudburst: 0, lightning: 0 };
    for (const r of rows) c[r.type] = (c[r.type] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="hazards-page" role="dialog" aria-label="Hazard Detection Telemetry">
      <div className="hazards-page-head">
        <div className="page-title">
          <span className="page-eyebrow mono">
            <AlertTriangle size={12} /> 03 · Hazards
          </span>
          <h1>Active hazards</h1>
          <p className="page-sub">
            Hail, lightning, cloudburst and downburst potential detected across India right now. Select a row to fly the map to it.
          </p>
          {hazards?.note && <p className="page-note mono">{hazards.note}</p>}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close page" style={{ width: 32, height: 32 }}>
          <X size={16} />
        </button>
      </div>

      <div className="hazards-page-body">
        <div className="page-stats" aria-label="Hazard totals">
          <div className="page-stat">
            <strong>{rows.length}</strong>
            <span className="mono">Total detections</span>
          </div>
          <div className="page-stat">
            <strong style={{ color: "var(--high-text)" }}>{rows.filter((r) => r.severity === "high").length}</strong>
            <span className="mono">High severity</span>
          </div>
          {ALL_TYPES.map((t) => (
            <div className="page-stat" key={t}>
              <strong style={{ color: HAZARD_COLOR[t] }}>{counts[t] ?? 0}</strong>
              <span className="mono">{t}</span>
            </div>
          ))}
        </div>

        <div className="hazard-filter-row">
          <button
            className={`hazard-filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Categories ({rows.length})
          </button>
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              className={`hazard-filter-btn ${filter === t ? "active" : ""}`}
              onClick={() => setFilter(t)}
            >
              <span className="dot" style={{ background: HAZARD_COLOR[t] }} />
              {t.toUpperCase()} ({counts[t] ?? 0})
            </button>
          ))}
        </div>

        {visibleRows.length === 0 ? (
          <div className="label mono" style={{ fontSize: "var(--fs-sm)", padding: "36px 0", textAlign: "center" }}>
            No active hazards detected for selected filter criteria.
          </div>
        ) : (
          <table className="hazards-table" aria-label="Hazards Table">
            <thead>
              <tr>
                <th>TYPE</th>
                <th>SEVERITY</th>
                <th>LOCATION</th>
                <th>METRIC</th>
                <th>TIMESTAMP</th>
                <th>EST. ARRIVAL</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => {
                const sevClass = r.severity === "high" ? "chip--high" : r.severity === "moderate" ? "chip--mod" : "chip--low";
                return (
                  <tr key={i} className="clickable" onClick={() => onSelectLocation(r.lat, r.lon)}>
                    <td>
                      <span className="type-chip">
                        <span className="dot" style={{ background: HAZARD_COLOR[r.type] }} />
                        {r.type.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`chip ${sevClass}`}>{r.severity.toUpperCase()}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, color: "var(--text)" }}>{r.location}</span>
                    </td>
                    <td className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text)" }}>
                      {r.metricValue}
                    </td>
                    <td className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)" }}>
                      {r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour12: false }) : "-"}
                    </td>
                    <td className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--accent)", fontWeight: 600 }}>
                      {r.etaMinutes !== undefined ? `+${Math.round(r.etaMinutes)}m` : "-"}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: "var(--fs-xs)",
                          color: "var(--text-2)",
                          fontFamily: "var(--font-num)",
                        }}
                      >
                        ZOOM <ArrowUpRight size={12} style={{ color: "var(--accent)" }} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
