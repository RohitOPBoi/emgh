import { X, Layers as LayersIcon } from "lucide-react";
import { BASE_LAYERS, OVERLAY_LAYERS } from "../lib/mosdacLayers";
import { VAR_COLOR_STOPS } from "../lib/colors";
import type { ModelId, WeatherLayer } from "../types";

type VarId = "none" | "temperature" | "humidity" | "wind_speed" | "pressure" | "rainfall" | "composite_risk";

export function LayersDrawer({
  onClose,
  model,
  onModelChange,
  dgmrUnavailable,
  modelFrameVisible,
  onModelFrameVisibleChange,
  baseMapId,
  onBaseMapChange,
  activeOverlayIds,
  onOverlayToggle,
  activeVar,
  onVarChange,
  activeVarMeta,
  weatherSource,
}: {
  onClose: () => void;
  model: ModelId;
  onModelChange: (m: ModelId) => void;
  dgmrUnavailable: boolean;
  modelFrameVisible: boolean;
  onModelFrameVisibleChange: (v: boolean) => void;
  baseMapId: string;
  onBaseMapChange: (id: string) => void;
  activeOverlayIds: Set<string>;
  onOverlayToggle: (id: string) => void;
  activeVar: VarId;
  onVarChange: (v: VarId) => void;
  activeVarMeta: WeatherLayer | null;
  weatherSource: "ecmwf-opendata" | "synthetic" | null;
}) {
  const stops = activeVar !== "none" ? VAR_COLOR_STOPS[activeVar] : null;

  return (
    <aside className="sidebar left floating-dock panel layers-dock" role="region" aria-label="Layer Configuration">
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
          <LayersIcon size={14} style={{ color: "var(--text-3)" }} />
          <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text)" }}>
            Layer Configuration
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
            GIS / WMS
          </span>
        </div>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close layers drawer"
          title="Close and return to Telemetry Deck"
          style={{ width: 26, height: 26 }}
        >
          <X size={13} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)", padding: "var(--s-3)" }}>
        {/* ── Model Selection ───────────────────────────────────────────── */}
        <div className="panel-section">
          <div className="section-title">
            <span>Nowcast Inference Model</span>
          </div>
          <div className="seg-row">
            <button
              className={`seg-btn ${model === "pysteps" ? "active" : ""}`}
              aria-pressed={model === "pysteps"}
              onClick={() => onModelChange("pysteps")}
            >
              PYSTEPS
            </button>
            <button
              className={`seg-btn ${model === "dgmr" ? "active" : ""}`}
              aria-pressed={model === "dgmr"}
              onClick={() => onModelChange("dgmr")}
              disabled={dgmrUnavailable}
              title={dgmrUnavailable ? "DGMR unavailable in this backend process" : undefined}
            >
              DGMR
            </button>
            <button
              className={`seg-btn ${model === "smaat" ? "active" : ""}`}
              aria-pressed={model === "smaat"}
              onClick={() => onModelChange("smaat")}
            >
              SMAAT-UNET
            </button>
          </div>
          <div className="label" style={{ marginTop: 8, lineHeight: 1.4 }}>
            {model === "pysteps"
              ? "LK optical-flow semi-Lagrangian extrapolation. Calibrated mm/hr, 0–6h horizon."
              : model === "dgmr"
                ? "DeepMind Skillful Nowcasting GAN zero-shot. Relative intensity, 0–90min horizon."
                : "SmaAt-UNet: attention U-Net architecture is implemented; fine-tuned weights are not loaded yet, so it reports unavailable."}
          </div>
          <label className="check-row" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={modelFrameVisible}
              onChange={(e) => onModelFrameVisibleChange(e.target.checked)}
            />
            <span className="mono" style={{ fontSize: "var(--fs-xs)" }}>RENDER MODEL RASTER OVERLAY</span>
          </label>
        </div>

        {/* ── Weather Variables ─────────────────────────────────────────── */}
        <div className="panel-section">
          <div className="section-title">
            <span>Weather Variable Overlays</span>
          </div>
          <div className="seg-row grid3" style={{ marginBottom: 6 }}>
            <button className={`seg-btn ${activeVar === "none" ? "active" : ""}`} onClick={() => onVarChange("none")}>
              NONE
            </button>
            <button className={`seg-btn ${activeVar === "temperature" ? "active" : ""}`} onClick={() => onVarChange("temperature")}>
              TEMP
            </button>
            <button className={`seg-btn ${activeVar === "humidity" ? "active" : ""}`} onClick={() => onVarChange("humidity")}>
              HUMID
            </button>
          </div>
          <div className="seg-row grid3" style={{ marginBottom: 6 }}>
            <button className={`seg-btn ${activeVar === "wind_speed" ? "active" : ""}`} onClick={() => onVarChange("wind_speed")}>
              WIND
            </button>
            <button className={`seg-btn ${activeVar === "pressure" ? "active" : ""}`} onClick={() => onVarChange("pressure")}>
              PRESSURE
            </button>
            <button className={`seg-btn ${activeVar === "rainfall" ? "active" : ""}`} onClick={() => onVarChange("rainfall")}>
              RAINFALL
            </button>
          </div>
          <div className="seg-row">
            <button
              className={`seg-btn ${activeVar === "composite_risk" ? "active" : ""}`}
              onClick={() => onVarChange("composite_risk")}
            >
              COMPOSITE RISK INDEX
            </button>
          </div>

          {stops && (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: "var(--r-pill)",
                  border: "1px solid var(--line)",
                  background: `linear-gradient(90deg, ${stops.join(",")})`,
                }}
              />
              <div
                className="mono"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                  color: "var(--text-3)",
                  marginTop: 5,
                }}
              >
                <span>{activeVarMeta ? `${activeVarMeta.vmin}${activeVarMeta.unit}` : "-"}</span>
                <span>{activeVarMeta ? `${activeVarMeta.vmax}${activeVarMeta.unit}` : "-"}</span>
              </div>
            </div>
          )}

          {weatherSource === "ecmwf-opendata" && activeVar !== "rainfall" && activeVar !== "composite_risk" && (
            <div className="note-text">
              <span className="real-badge">REAL</span>
              ECMWF Open Data HRES 0.25° grid (CC-BY-4.0).
            </div>
          )}
          {weatherSource !== null &&
            weatherSource !== "ecmwf-opendata" &&
            ["temperature", "humidity", "wind_speed", "pressure"].includes(activeVar) && (
              <div className="note-text">
                <span className="synthetic-badge">SYNTHETIC</span>
                Ambient field is a synthetic climatology. Set USE_LIVE_ECMWF=true for real ECMWF Open Data.
              </div>
            )}
        </div>

        {/* ── Base Map Selection ────────────────────────────────────────── */}
        <div className="panel-section">
          <div className="section-title">
            <span>Basemap Selection</span>
          </div>
          <select
            className="field"
            value={baseMapId}
            onChange={(e) => onBaseMapChange(e.target.value)}
            aria-label="Basemap"
          >
            <option value="none">Agrim India base (default)</option>
            {BASE_LAYERS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          <div className="note-text">
            <span className="real-badge">REAL</span>
            ISRO / MOSDAC WMS basemap feed.
          </div>
        </div>

        {/* ── GIS WMS Overlays ──────────────────────────────────────────── */}
        <div className="panel-section">
          <div className="section-title">
            <span>ISRO MOSDAC WMS Overlays</span>
            <span className="count">({activeOverlayIds.size} active)</span>
          </div>
          <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
            {OVERLAY_LAYERS.map((l) => (
              <label className="check-row" key={l.id}>
                <input
                  type="checkbox"
                  checked={activeOverlayIds.has(l.id)}
                  onChange={() => onOverlayToggle(l.id)}
                />
                <span className="mono" style={{ fontSize: "var(--fs-xs)" }}>{l.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
