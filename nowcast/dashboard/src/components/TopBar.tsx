import { Map, Layers, Cpu, AlertTriangle, History, Maximize2, Minimize2 } from "lucide-react";
import type { ModelId } from "../types";
import type { ActivePanel } from "./LeftNavigation";

interface TopBarProps {
  activePanel: ActivePanel;
  onSelectPanel: (panel: ActivePanel) => void;
  apiOk: boolean;
  lastUpdated: Date | null;
  model: ModelId;
  onModelChange: (m: ModelId) => void;
  dgmrUnavailable?: boolean;
  hazardCount?: number;
  isCanvasMode?: boolean;
  onToggleCanvasMode?: () => void;
}

export function TopBar({
  activePanel,
  onSelectPanel,
  apiOk,
  lastUpdated,
  model,
  onModelChange,
  dgmrUnavailable = false,
  hazardCount = 0,
  isCanvasMode = false,
  onToggleCanvasMode,
}: TopBarProps) {
  const togglePanel = (target: ActivePanel) => {
    if (activePanel === target) {
      onSelectPanel("none");
    } else {
      onSelectPanel(target);
    }
  };

  return (
    <header className="topbar" role="banner">
      {/* ── Left: Brand & Threat Indicator ──────────────────────────── */}
      <div className="brand">
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-mark" title="Megh Convective Radar & Nowcasting System">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 20V5h3.5l5.5 8.5L17.5 5H21v15h-3.5V10.2L12.5 18h-1L6.5 10.2V20H3Z"
                fill="var(--text)"
              />
              <circle cx="12" cy="6.5" r="1.5" fill="var(--accent)" />
            </svg>
          </div>
          <div className="brand-text">
            <h1>
              Megh
              <span className="badge">OPERATIONS</span>
            </h1>
          </div>
        </a>

        {hazardCount > 0 ? (
          <button
            onClick={() => togglePanel("hazards")}
            className="chip chip--critical"
            style={{ cursor: "pointer", border: 0, padding: "4px 10px" }}
            title="Click to inspect all active severe hazards"
          >
            <AlertTriangle size={12} />
            <span>{hazardCount} SEVERE</span>
          </button>
        ) : (
          <div
            className="chip chip--low"
            style={{ padding: "4px 10px" }}
          >
            <div className="dot dot--low" style={{ width: 6, height: 6 }} />
            <span>CALM</span>
          </div>
        )}
      </div>

      {/* ── Center: Top Navigation Segmented Control ─────────────────────────── */}
      <nav className="seg top-nav-bar" aria-label="Operations Primary Navigation">
        <button
          className={`top-nav-item ${activePanel === "none" ? "active" : ""}`}
          aria-pressed={activePanel === "none"}
          onClick={() => onSelectPanel("none")}
          title="Live Map Overview & Sensor Ingestion"
        >
          <Map size={15} strokeWidth={2} />
          <span>MAP</span>
        </button>

        <button
          className={`top-nav-item ${activePanel === "layers" ? "active" : ""}`}
          aria-pressed={activePanel === "layers"}
          onClick={() => togglePanel("layers")}
          title="GIS, Radar, Satellite & Weather Overlays"
        >
          <Layers size={15} strokeWidth={2} />
          <span>LAYERS</span>
        </button>

        <button
          className={`top-nav-item ${activePanel === "hazards" ? "active" : ""}`}
          aria-pressed={activePanel === "hazards"}
          onClick={() => togglePanel("hazards")}
          title="Severe Hazards Table & Warning Vectors"
        >
          <AlertTriangle size={15} strokeWidth={2} />
          <span>HAZARDS</span>
          {hazardCount > 0 && (
            <span className="top-nav-badge">
              {hazardCount}
            </span>
          )}
        </button>

        <button
          className={`top-nav-item ${activePanel === "forecast" ? "active" : ""}`}
          aria-pressed={activePanel === "forecast"}
          onClick={() => togglePanel("forecast")}
          title="Nowcast Models (pySTEPS / DGMR / SmaAt-UNet) & Benchmark"
        >
          <Cpu size={15} strokeWidth={2} />
          <span>MODELS</span>
        </button>

        <button
          className={`top-nav-item ${activePanel === "replay" ? "active" : ""}`}
          aria-pressed={activePanel === "replay"}
          onClick={() => togglePanel("replay")}
          title="Historical Radar & Hazard Replay"
        >
          <History size={15} strokeWidth={2} />
          <span>REPLAY</span>
        </button>
      </nav>

      {/* ── Right: Model Engine Selector, Cycle Clock & View Mode ───────── */}
      <div className="topbar-right">
        {/* Model Switcher Segmented Control */}
        <div
          className="seg"
          style={{ padding: 2, gap: 2 }}
          title="Active Nowcast Engine & Prediction Horizon"
        >
          <button
            aria-pressed={model === "pysteps"}
            onClick={() => onModelChange("pysteps")}
            style={{ padding: "4px 10px", fontSize: "var(--fs-xs)" }}
          >
            pySTEPS <span style={{ opacity: 0.65, fontSize: 10 }}>(0–6h)</span>
          </button>
          <button
            aria-pressed={model === "dgmr"}
            onClick={() => onModelChange("dgmr")}
            disabled={dgmrUnavailable}
            style={{ padding: "4px 10px", fontSize: "var(--fs-xs)" }}
            title={dgmrUnavailable ? "DGMR model unavailable" : undefined}
          >
            DGMR <span style={{ opacity: 0.65, fontSize: 10 }}>(0–90m)</span>
          </button>
          <button
            aria-pressed={model === "smaat"}
            onClick={() => onModelChange("smaat")}
            style={{ padding: "4px 10px", fontSize: "var(--fs-xs)" }}
          >
            SmaAt <span style={{ opacity: 0.65, fontSize: 10 }}>(0–60m)</span>
          </button>
        </div>

        {/* Live Cycle Timestamp */}
        <div
          className="tile"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: "var(--fs-xs)",
            fontFamily: "var(--font-num)",
            color: "var(--text)",
            padding: "5px 12px",
            borderRadius: "var(--r-pill)",
          }}
        >
          <div
            className="dot dot--low"
            style={{ width: 6, height: 6 }}
          />
          <span>{lastUpdated ? `CYCLE ${lastUpdated.toLocaleTimeString([], { hour12: false })}` : "SYNCING…"}</span>
        </div>

        {/* Canvas / Immersion Mode Toggle */}
        {onToggleCanvasMode && (
          <button
            className="icon-btn"
            onClick={onToggleCanvasMode}
            title={isCanvasMode ? "Switch to Tactical Mode (Docked Panels)" : "Switch to Full Canvas Immersion"}
            style={{
              background: isCanvasMode ? "var(--accent)" : "var(--surface-2)",
              color: isCanvasMode ? "var(--on-accent)" : "var(--text-2)",
            }}
          >
            {isCanvasMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}

        {/* Live Ingest Status */}
        <div
          className="live-badge"
          title={apiOk ? "Telemetry ingest active" : "Offline"}
        >
          <div
            className="live-dot"
            style={{
              background: apiOk ? "var(--low)" : "var(--line-strong)",
            }}
          />
          <span>{apiOk ? "LIVE" : "OFFLINE"}</span>
        </div>
      </div>
    </header>
  );
}
