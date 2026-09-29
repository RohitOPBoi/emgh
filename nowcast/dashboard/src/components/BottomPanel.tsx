import { Play, Pause, Activity, Clock, History, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { TrendChart } from "./TrendChart";
import type { ForecastSummary, HazardsResponse, ModelId } from "../types";

const TIMELINE_STEPS_PYSTEPS = [0, 60, 120, 180, 240, 300, 360];
const TIMELINE_STEPS_DGMR = [0, 15, 30, 45, 60, 75, 90];
const TIMELINE_STEPS_SMAAT = [0, 10, 20, 30, 40, 50, 60];

const LEAD_MAX = { pysteps: 360, dgmr: 90, smaat: 60 } as const;

export function BottomPanel({
  model,
  leadMinutes,
  onLeadChange,
  isPlaying,
  onTogglePlay,
  forecast,
  hazards,
  onOpenReplay,
}: {
  model: ModelId;
  leadMinutes: number;
  onLeadChange: (m: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  forecast: ForecastSummary | null;
  hazards: HazardsResponse | null;
  onOpenReplay: () => void;
}) {
  const [minimized, setMinimized] = useState(false);

  const steps =
    model === "dgmr" ? TIMELINE_STEPS_DGMR : model === "smaat" ? TIMELINE_STEPS_SMAAT : TIMELINE_STEPS_PYSTEPS;

  const trendPoints =
    forecast?.timestamps_min && (forecast.max_rainrate_mm_hr || forecast.max_intensity)
      ? forecast.timestamps_min.map((t, i) => ({
        leadMin: t,
        value: (forecast.max_rainrate_mm_hr ?? forecast.max_intensity)![i],
      }))
      : [];

  const recentEvents = (hazards?.features ?? [])
    .filter((f) => f.properties.station_id && f.properties.timestamp)
    .slice(0, 3);

  const leadLabel = leadMinutes === 0 ? "NOW" : `+${Math.floor(leadMinutes / 60)}h ${leadMinutes % 60 ? `${leadMinutes % 60}m` : ""}`;

  if (minimized) {
    return (
      <div className="dock-bottom-minimized" onClick={() => setMinimized(false)}>
        <Clock size={13} style={{ color: "var(--text-3)" }} />
        <span className="mono" style={{ fontSize: "var(--fs-xs)", fontWeight: 600 }}>
          {model.toUpperCase()} · {leadLabel}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
          className="btn-primary"
          style={{ width: 22, height: 22, padding: 0, borderRadius: "var(--r-pill)" }}
        >
          {isPlaying ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
        </button>
        <ChevronUp size={14} style={{ color: "var(--text-3)" }} />
      </div>
    );
  }

  return (
    <div className="dock-bottom panel" role="region" aria-label="Playback and Timeline Console">
      {/* ── Left: Playback & Timeline Scrubber ─────────────────────────── */}
      <div style={{ flex: "1 1 460px", minWidth: 440, display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
        {/* Top Header of Console */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button
              onClick={onTogglePlay}
              className="btn btn-primary"
              style={{
                width: 28,
                height: 28,
                padding: 0,
                borderRadius: "var(--r-pill)",
              }}
              title={isPlaying ? "Pause nowcast simulation" : "Play nowcast simulation"}
            >
              {isPlaying ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}
            </button>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
              <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text)" }}>
                {model.toUpperCase()}
              </span>
              <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--accent)", fontWeight: 600 }}>
                {leadLabel}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            {/* Step Pills */}
            <div className="seg" style={{ padding: 2 }}>
              {steps.map((m) => {
                const isActive = m === leadMinutes;
                return (
                  <button
                    key={m}
                    aria-pressed={isActive}
                    onClick={() => onLeadChange(m)}
                    style={{
                      padding: "3px 8px",
                      fontSize: 10,
                    }}
                  >
                    {m === 0 ? "T0" : `+${m}m`}
                  </button>
                );
              })}
            </div>

            <button
              className="icon-btn"
              onClick={() => setMinimized(true)}
              title="Minimize console"
              style={{ width: 24, height: 24, marginLeft: 2 }}
            >
              <ChevronDown size={12} />
            </button>
          </div>
        </div>

        {/* Master Slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>0m</span>
          <input
            type="range"
            min={0}
            max={LEAD_MAX[model]}
            step={model === "dgmr" ? 5 : 10}
            value={Math.min(leadMinutes, LEAD_MAX[model])}
            onChange={(e) => onLeadChange(parseInt(e.target.value, 10))}
            style={{ flex: 1 }}
            aria-label="Master nowcast lead time slider"
          />
          <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>{LEAD_MAX[model]}m</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 38, background: "var(--line)", margin: "0 4px", flexShrink: 0 }} />

      {/* ── Center: Integrated Intensity Curve ─────────────────────────── */}
      <div style={{ width: 190, display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--text)" }}>
            <Activity size={12} style={{ color: "var(--text-3)" }} />
            Intensity Curve
          </span>
          <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>
            mm/hr
          </span>
        </div>
        {trendPoints.length > 1 ? (
          <TrendChart points={trendPoints} color="var(--radar-3)" unit={model === "dgmr" ? "" : " mm/h"} height={30} />
        ) : (
          <div className="label mono" style={{ padding: "6px 0" }}>
            CALCULATING…
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 38, background: "var(--line)", margin: "0 4px", flexShrink: 0 }} />

      {/* ── Right: Anomalies Ticker & Replay Trigger ───────────────────── */}
      <div style={{ width: 160, display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="label mono" style={{ textTransform: "uppercase" }}>
            Alerts ({recentEvents.length})
          </span>
          {recentEvents.slice(0, 1).map((f, i) => (
            <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span className="dot dot--high" style={{ display: "inline-block", width: 6, height: 6, marginRight: 4 }} />
              {f.properties.name || f.properties.station_id}: {f.properties.hazards.map((h) => h.type.toUpperCase()).join(", ")}
            </div>
          ))}
          {recentEvents.length === 0 && (
            <div className="label mono">
              No critical anomalies
            </div>
          )}
        </div>

        <button
          onClick={onOpenReplay}
          className="btn btn-quiet"
          style={{
            padding: "4px 10px",
            fontSize: "var(--fs-xs)",
            marginTop: 4,
          }}
        >
          <History size={12} />
          <span>Historical Replay</span>
        </button>
      </div>
    </div>
  );
}
