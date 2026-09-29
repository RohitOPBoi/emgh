import { Compass, CloudLightning, Navigation, ChevronRight, ChevronLeft, BarChart2, X } from "lucide-react";
import { windCompass, RADAR_STEPS } from "../lib/colors";
import type { ForecastSummary, Hazard, HazardType, StormCell, WeatherLayer } from "../types";

const HAZARD_META: Record<HazardType, { label: string; tag: string }> = {
  hail: { label: "Hail Storm", tag: "CONVECTIVE" },
  lightning: { label: "Lightning Front", tag: "VLF SENSOR" },
  downburst: { label: "Downburst Gust", tag: "RADIAL SHEAR" },
  cloudburst: { label: "Cloudburst Peak", tag: "EXTRAPOLATION" },
};

const HIGH_THRESHOLD = 30;
const MODERATE_THRESHOLD = 15;

function findSoonest(cells: StormCell[], type: HazardType): { cell: StormCell; hazard: Hazard } | null {
  let best: { cell: StormCell; hazard: Hazard } | null = null;
  for (const cell of cells) {
    const hazard = cell.hazards.find((h) => h.type === type);
    if (hazard && (!best || cell.eta_minutes < best.cell.eta_minutes)) {
      best = { cell, hazard };
    }
  }
  return best;
}

function formatEta(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `+${h}h ${m}m` : `+${m}m`;
}

function bucketSeverity(forecast: ForecastSummary | null, fromMin: number, toMin: number): { label: string; color: string; bg: string } {
  if (!forecast?.timestamps_min || !forecast.max_rainrate_mm_hr) {
    return { label: "—", color: "var(--text-3)", bg: "transparent" };
  }
  let max = 0;
  forecast.timestamps_min.forEach((t, i) => {
    if (t >= fromMin && t <= toMin) max = Math.max(max, forecast.max_rainrate_mm_hr![i]);
  });
  if (max >= HIGH_THRESHOLD) return { label: "HIGH", color: "var(--high-text)", bg: "var(--high-bg)" };
  if (max >= MODERATE_THRESHOLD) return { label: "MOD", color: "var(--mod-text)", bg: "var(--mod-bg)" };
  return { label: "LOW", color: "var(--low-text)", bg: "var(--low-bg)" };
}

export function RightSidebar({
  stormCells,
  forecast,
  collapsed = false,
  onToggleCollapse,
  showLegend = true,
  onToggleLegend,
  activeVarMeta,
  slotRef,
}: {
  stormCells: StormCell[] | null;
  forecast: ForecastSummary | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  showLegend?: boolean;
  onToggleLegend?: () => void;
  activeVarMeta?: WeatherLayer | null;
  /** Mount point for the rain-simulation card at the top of the dock. */
  slotRef?: (el: HTMLDivElement | null) => void;
}) {
  const cells = stormCells ?? [];
  const primaryCell = cells.length ? [...cells].sort((a, b) => a.eta_minutes - b.eta_minutes)[0] : null;
  const buckets = [
    { label: "0–1h", from: 0, to: 60 },
    { label: "1–2h", from: 60, to: 120 },
    { label: "2–4h", from: 120, to: 240 },
    { label: "4–6h", from: 240, to: 360 },
  ];

  const renderLegendCard = () => (
    <aside className="map-legend-docked panel" role="region" aria-label="Radar and Severity Legends">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 8,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <BarChart2 size={13} style={{ color: "var(--text-3)" }} />
          <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--text)" }}>
            Radar & Hazard Legends
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            className="chip"
            style={{
              fontSize: 10,
              padding: "1px 6px",
              background: "var(--surface-2)",
              color: "var(--text-2)",
              border: "1px solid var(--line)",
            }}
          >
            4-STEP
          </span>
          {onToggleLegend && (
            <button
              onClick={onToggleLegend}
              title="Close legend"
              className="icon-btn"
              style={{ width: 18, height: 18 }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Section 1: Radar Reflectivity (dBZ) — 4 Discrete Steps */}
      <div className="panel-section" style={{ gap: 6 }}>
        <div className="section-title">
          <span>Radar Reflectivity</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>dBZ Scale</span>
        </div>
        {/* Discrete 4-step bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 2,
            height: 8,
            borderRadius: "var(--r-pill)",
            overflow: "hidden",
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ background: "var(--radar-1)" }} title="10–25 dBZ (Light)" />
          <div style={{ background: "var(--radar-2)" }} title="25–45 dBZ (Moderate)" />
          <div style={{ background: "var(--radar-3)" }} title="45–55 dBZ (Heavy)" />
          <div style={{ background: "var(--radar-4)" }} title="55+ dBZ (Severe)" />
        </div>
        {/* Categorical ranges */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 4,
            marginTop: 4,
          }}
        >
          {RADAR_STEPS.map((s) => (
            <div
              key={s.dbz}
              className="tile"
              style={{ textAlign: "center", padding: "4px 2px" }}
            >
              <div className="mono" style={{ fontSize: 9.5, color: s.color, fontWeight: 600 }}>{s.dbz}</div>
              <div className="label" style={{ fontSize: 8.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Convective Threat Severity */}
      <div className="panel-section" style={{ gap: 6 }}>
        <div className="section-title">
          <span>Convective Threat Severity</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          <div className="chip chip--high" style={{ justifyContent: "center", padding: "5px 6px" }}>
            <div className="dot dot--high" />
            <span>HIGH</span>
          </div>
          <div className="chip chip--mod" style={{ justifyContent: "center", padding: "5px 6px" }}>
            <div className="dot dot--mod" />
            <span>MOD</span>
          </div>
          <div className="chip chip--low" style={{ justifyContent: "center", padding: "5px 6px" }}>
            <div className="dot dot--low" />
            <span>LOW</span>
          </div>
        </div>
      </div>

      {/* Section 3: Optional Active Layer Variable */}
      {activeVarMeta && (
        <div className="panel-section" style={{ gap: 4 }}>
          <div className="section-title">
            <span>Layer: {activeVarMeta.label}</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>{activeVarMeta.unit}</span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: "var(--r-pill)",
              background: "linear-gradient(90deg, var(--surface-3), var(--radar-2), var(--radar-4))",
              border: "1px solid var(--line)",
            }}
          />
        </div>
      )}
    </aside>
  );

  // When collapsed, render floating trigger badge
  if (collapsed) {
    return (
      <div className="right-dock-stack" style={{ alignItems: "flex-end" }}>
        <div ref={slotRef} className="rain-slot" />
        <div
          className="dock-badge-right"
          style={{ position: "relative", top: "auto", right: "auto" }}
          onClick={onToggleCollapse}
          title="Expand Threat Matrix & Storm Trajectory"
        >
          <span className="mono" style={{ fontSize: "var(--fs-xs)", fontWeight: 600 }}>
            {primaryCell ? `ETA: ${formatEta(primaryCell.eta_minutes)}` : "THREAT MATRIX"}
          </span>
          <ChevronLeft size={14} style={{ color: "var(--text-2)" }} />
        </div>
        {showLegend && renderLegendCard()}
      </div>
    );
  }

  return (
    <div className="right-dock-stack">
      <div ref={slotRef} className="rain-slot" />
      {/* ── Threat Matrix Container ────────────────────────────────────────── */}
      <aside
        className="sidebar right floating-dock panel"
        aria-label="Hazard Warnings and Storm ETA"
        style={{
          position: "relative",
          top: "auto",
          right: "auto",
          bottom: "auto",
          width: "100%",
          height: "fit-content",
          maxHeight: "none",
        }}
      >
        {/* Header bar with collapse button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--s-3) var(--s-4)",
            borderBottom: "1px solid var(--line)",
            background: "var(--surface-1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CloudLightning size={14} style={{ color: "var(--text-3)" }} />
            <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text)" }}>
              Threat Matrix
            </span>
          </div>
          {onToggleCollapse && (
            <button
              className="icon-btn"
              onClick={onToggleCollapse}
              title="Collapse panel"
              style={{ width: 26, height: 26 }}
            >
              <ChevronRight size={13} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)", padding: "var(--s-3)" }}>
          {/* ── Active Hazard Detections ───────────────────────────────────── */}
          <div className="panel-section">
            <div className="section-title">
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <CloudLightning size={13} style={{ color: cells.length > 0 ? "var(--high)" : "var(--text-3)" }} />
                Imminent Storm Cells
              </span>
              <span className="count">{cells.length} detected</span>
            </div>

            {(Object.keys(HAZARD_META) as HazardType[]).map((type) => {
              const found = findSoonest(cells, type);
              const meta = HAZARD_META[type];
              if (!found) return null;
              const { cell, hazard } = found;
              const isHigh = hazard.severity === "high";

              return (
                <div className="tile" key={type} style={{ marginBottom: 8, padding: "var(--s-3)" }}>
                  <div className="hazard-head" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{meta.label}</span>
                    <span
                      className={isHigh ? "chip chip--high" : "chip chip--mod"}
                      style={{ fontSize: 9.5, padding: "1px 6px" }}
                    >
                      {meta.tag}
                    </span>
                  </div>

                  <div className="hazard-stats">
                    {type === "hail" && hazard.reflectivity_dbz !== undefined && (
                      <div className="hazard-stat">
                        <span className="lbl">Reflectivity</span>
                        <span className="val" style={{ color: "var(--radar-4)" }}>
                          {hazard.reflectivity_dbz} dBZ
                        </span>
                      </div>
                    )}
                    {type === "downburst" && hazard.velocity_delta_ms !== undefined && (
                      <div className="hazard-stat">
                        <span className="lbl">Velocity Delta</span>
                        <span className="val" style={{ color: "var(--high)" }}>
                          {hazard.velocity_delta_ms} m/s
                        </span>
                      </div>
                    )}
                    {type === "cloudburst" && hazard.rainrate_mm_hr !== undefined && (
                      <div className="hazard-stat">
                        <span className="lbl">Rain Rate</span>
                        <span className="val" style={{ color: "var(--radar-3)" }}>
                          {hazard.rainrate_mm_hr} mm/hr
                        </span>
                      </div>
                    )}
                    {type === "lightning" && (
                      <div className="hazard-stat">
                        <span className="lbl">Severity</span>
                        <span className="val" style={{ color: "var(--mod-text)" }}>
                          {hazard.severity.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="hazard-stat" style={{ textAlign: "right" }}>
                      <span className="lbl">Est. Arrival</span>
                      <span
                        className="val mono"
                        style={{ color: "var(--text)", fontWeight: 600 }}
                      >
                        {formatEta(cell.eta_minutes)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {cells.length === 0 && (
              <div className="label mono" style={{ padding: "10px 0", textAlign: "center" }}>
                No high-severity cells in active scan zone
              </div>
            )}

            {/* ── Storm Motion Vector Card ─────────────────────────────────── */}
            {primaryCell && (
              <div
                className="tile"
                style={{ marginTop: 8, padding: "var(--s-3)" }}
              >
                <div className="hazard-head" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Navigation size={12} style={{ transform: `rotate(${primaryCell.bearing_deg}deg)`, color: "var(--accent)" }} />
                    <span style={{ fontWeight: 600 }}>Motion Trajectory</span>
                  </div>
                  <span className="label mono">
                    {primaryCell.motion_source.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-2)", marginTop: 6 }}>
                  <div>
                    <div className="label mono">BEARING</div>
                    <div className="mono" style={{ fontSize: "var(--fs-sm)", color: "var(--text)", fontWeight: 600 }}>
                      {windCompass(primaryCell.bearing_deg)} ({primaryCell.bearing_deg}°)
                    </div>
                  </div>
                  <div>
                    <div className="label mono">VELOCITY</div>
                    <div className="mono" style={{ fontSize: "var(--fs-sm)", color: "var(--text)", fontWeight: 600 }}>
                      {primaryCell.speed_kmh} KM/H
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Forecast Horizon Buckets ──────────────────────────────────── */}
          <div className="panel-section">
            <div className="section-title">
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Compass size={13} style={{ color: "var(--text-3)" }} />
                6-Hour Rain-Rate Outlook
              </span>
              <span className="count">Convective</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {buckets.map((b) => {
                const sev = bucketSeverity(forecast, b.from, b.to);
                return (
                  <div
                    key={b.label}
                    className="tile"
                    style={{
                      background: sev.bg || "var(--surface-2)",
                      border: "1px solid var(--line)",
                      padding: "8px 4px",
                      textAlign: "center",
                    }}
                  >
                    <div className="label mono">
                      {b.label}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: sev.color,
                        marginTop: 3,
                      }}
                    >
                      {sev.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Radar & Severity Legend Card ─────────────────────────────────── */}
      {showLegend && renderLegendCard()}
    </div>
  );
}
