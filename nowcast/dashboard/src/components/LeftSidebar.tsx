import { Activity, Download, MapPin, Database, Gauge, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import type { HazardsResponse, ModelId, RegionsResponse } from "../types";
import { api } from "../api";

const HAZARD_LABELS: Record<string, string> = {
  hail: "Hail Cells",
  lightning: "Lightning Strikes",
};

function countByType(hazards: HazardsResponse | null): Record<string, number> {
  const counts: Record<string, number> = { hail: 0, lightning: 0 };
  if (!hazards) return counts;
  for (const f of hazards.features) {
    for (const h of f.properties.hazards) {
      counts[h.type] = (counts[h.type] ?? 0) + 1;
    }
  }
  return counts;
}

function exportHazards(hazards: HazardsResponse | null) {
  if (!hazards) return;
  const blob = new Blob([JSON.stringify(hazards, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `megh-hazards-${new Date().toISOString().replace(/[:.]/g, "-")}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
}

function RegionPicker() {
  const [regions, setRegions] = useState<RegionsResponse | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    api.regions().then(setRegions).catch(() => setRegions(null));
  }, []);

  const onChange = async (key: string) => {
    if (!regions || key === regions.active) return;
    setSwitching(true);
    try {
      await api.setRegion(key);
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  };

  return (
    <div className="panel-section">
      <div className="section-title">
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <MapPin size={13} style={{ color: "var(--text-3)" }} />
          Radar Analysis Sector
        </span>
        <span className="count">{regions?.options?.length ?? 1} zones</span>
      </div>
      <select
        className="field"
        value={regions?.active ?? ""}
        disabled={!regions || switching}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Select region"
      >
        {(regions?.options ?? []).map((r) => (
          <option key={r.key} value={r.key}>
            {r.name}
          </option>
        ))}
      </select>
      {switching && (
        <div className="label mono" style={{ marginTop: 8, color: "var(--text-2)" }}>
          RE-INGESTING REGIONAL SCAN…
        </div>
      )}
    </div>
  );
}

export function LeftSidebar({
  hazards,
  model,
  apiOk,
  lastUpdated,
  collapsed = false,
  onToggleCollapse,
  onOpenHazards,
}: {
  hazards: HazardsResponse | null;
  model: ModelId;
  apiOk: boolean;
  lastUpdated: Date | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenHazards?: () => void;
}) {
  const counts = countByType(hazards);
  const totalHazards = counts.hail + counts.lightning;

  // When collapsed, show slim floating badge
  if (collapsed) {
    return (
      <div
        className="dock-badge-left"
        onClick={onToggleCollapse}
        title="Expand Telemetry & Sensor Deck"
      >
        <ChevronRight size={14} style={{ color: "var(--text-2)" }} />
        <span className="mono" style={{ fontSize: "var(--fs-xs)", fontWeight: 600 }}>
          {totalHazards > 0 ? `${totalHazards} CELLS` : "TELEMETRY"}
        </span>
      </div>
    );
  }

  return (
    <aside className="sidebar left floating-dock panel" aria-label="Pipeline Telemetry">
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
          <Gauge size={14} style={{ color: "var(--text-3)" }} />
          <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text)" }}>
            Telemetry Deck
          </span>
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
            {model.toUpperCase()}
          </span>
        </div>
        {onToggleCollapse && (
          <button
            className="icon-btn"
            onClick={onToggleCollapse}
            title="Collapse panel"
            style={{ width: 26, height: 26 }}
          >
            <ChevronLeft size={13} />
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)", padding: "var(--s-3)" }}>
        <RegionPicker />

        {/* ── Active Hazards Metric Grid ─────────────────────────────────── */}
        <div className="panel-section">
          <div className="section-title">
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <AlertTriangle size={13} style={{ color: totalHazards > 0 ? "var(--high)" : "var(--text-3)" }} />
              Active Severe Cells
            </span>
            {onOpenHazards && (
              <button
                onClick={onOpenHazards}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  fontSize: "var(--fs-xs)",
                  fontFamily: "var(--font-num)",
                  color: "var(--text-2)",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                TABLE &rarr;
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-2)" }}>
            {Object.entries(HAZARD_LABELS).map(([type, label]) => {
              const count = counts[type];
              return (
                <div
                  key={type}
                  className="tile"
                  onClick={onOpenHazards}
                  style={{
                    cursor: "pointer",
                    padding: "var(--s-3)",
                    transition: "border-color 120ms",
                  }}
                >
                  <div className="label mono" style={{ marginBottom: 6, textTransform: "uppercase" }}>
                    {label}
                  </div>
                  <div
                    className="stat"
                    style={{
                      color: count > 0 ? "var(--high)" : "var(--text)",
                    }}
                  >
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Pipeline Status ────────────────────────────────────────────── */}
        <div className="panel-section">
          <div className="section-title">
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Activity size={13} style={{ color: "var(--text-3)" }} />
              Telemetry Pipeline
            </span>
            <span className={apiOk ? "chip chip--low" : "chip chip--high"}>
              <div className={apiOk ? "dot dot--low" : "dot dot--high"} />
              {apiOk ? "STREAMING" : "OFFLINE"}
            </span>
          </div>
          <div className="source-toggle">
            <div className="name">
              <div className={`dot ${apiOk ? "dot--low" : "dot--high"}`} />
              <span>FastAPI Core Ingest</span>
            </div>
            <div className="status" style={{ color: apiOk ? "var(--low-text)" : "var(--high-text)" }}>
              {apiOk ? "ONLINE" : "OFFLINE"}
            </div>
          </div>
          <div className="label mono" style={{ marginTop: 8 }}>
            {lastUpdated ? `CYCLE: ${lastUpdated.toLocaleTimeString([], { hour12: false })}` : "CYCLE: PENDING"}
          </div>
        </div>

        {/* ── Ingestion Sources ─────────────────────────────────────────── */}
        <div className="panel-section">
          <div className="section-title">
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Database size={13} style={{ color: "var(--text-3)" }} />
              Sensor Ingestion Feeds
            </span>
            <span className="count">3 feeds</span>
          </div>
          <div className="source-toggle">
            <div className="name">
              <div className={`dot ${apiOk ? "dot--low" : "dot--high"}`} />
              <span>IMD Doppler Radar</span>
            </div>
            <div className="status" style={{ color: apiOk ? "var(--low-text)" : "var(--high-text)" }}>
              {apiOk ? "ONLINE" : "WAIT"}
            </div>
          </div>
          <div className="source-toggle">
            <div className="name">
              <div className={`dot ${apiOk ? "dot--low" : "dot--high"}`} />
              <span>INSAT-3DR / Sentinel IR</span>
            </div>
            <div className="status" style={{ color: apiOk ? "var(--low-text)" : "var(--high-text)" }}>
              {apiOk ? "ONLINE" : "WAIT"}
            </div>
          </div>
          <div className="source-toggle">
            <div className="name">
              <div className={`dot ${apiOk ? "dot--low" : "dot--high"}`} />
              <span>Blitzortung VLF Lightning</span>
            </div>
            <div className="status" style={{ color: apiOk ? "var(--low-text)" : "var(--high-text)" }}>
              {apiOk ? "STREAMING" : "WAIT"}
            </div>
          </div>
        </div>

        {/* ── Operational Actions ───────────────────────────────────────── */}
        <div style={{ marginTop: 4 }}>
          <button
            className="btn btn-primary"
            onClick={() => exportHazards(hazards)}
            disabled={!hazards}
            title="Export current hazard geometry as GeoJSON"
            style={{ width: "100%" }}
          >
            <Download size={14} />
            <span>Export Hazards (GeoJSON)</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
