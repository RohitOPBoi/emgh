import { useEffect, useState } from "react";
import { Pause, Play, X, History } from "lucide-react";
import { api } from "../api";
import { HAZARD_COLOR } from "../lib/colors";
import type { HistoryHazardsResponse } from "../types";

function parseTimestamp(ts: string): Date {
  const iso = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}Z`;
  return new Date(iso);
}

export function ReplayPage({ onClose }: { onClose: () => void }) {
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [snapshot, setSnapshot] = useState<HistoryHazardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    api.historyTimestamps().then((res) => {
      setTimestamps(res.timestamps);
      setIndex(Math.max(0, res.timestamps.length - 1));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!timestamps.length) return;
    api.historyHazards(timestamps[index]).then(setSnapshot);
  }, [timestamps, index]);

  useEffect(() => {
    if (!isPlaying || !timestamps.length) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1 >= timestamps.length ? 0 : i + 1));
    }, 1200);
    return () => clearInterval(id);
  }, [isPlaying, timestamps.length]);

  const counts: Record<string, number> = { hail: 0, downburst: 0, lightning: 0 };
  for (const f of snapshot?.features ?? []) {
    for (const h of f.properties.hazards) counts[h.type] = (counts[h.type] ?? 0) + 1;
  }

  return (
    <div className="hazards-page" role="dialog" aria-label="Historical Replay">
      <div className="hazards-page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <History size={18} style={{ color: "var(--text-3)" }} />
          <h1>Historical Radar & Severe Hazard Replay</h1>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close page" style={{ width: 32, height: 32 }}>
          <X size={16} />
        </button>
      </div>

      <div className="hazards-page-body">
        {loading ? (
          <div className="label mono" style={{ fontSize: "var(--fs-sm)", padding: "24px 0" }}>
            Querying historical snapshot archive…
          </div>
        ) : timestamps.length === 0 ? (
          <div className="label mono" style={{ fontSize: "var(--fs-sm)", lineHeight: 1.6, padding: "24px 0" }}>
            No persisted snapshot cycles available in local archive. The ingest pipeline writes one snapshot every 15 minutes.
          </div>
        ) : (
          <>
            <div className="note-text" style={{ marginBottom: 18, borderTop: "none", paddingTop: 0 }}>
              <span className="real-badge">REAL DATA</span>
              Reconstructed from persisted IMD Doppler, Blitzortung, and satellite sensor frames.
            </div>

            {/* ── Player HUD ─────────────────────────────────── */}
            <div
              className="panel"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 20,
                padding: "12px 18px",
              }}
            >
              <button
                className="btn btn-primary"
                style={{
                  width: 32,
                  height: 32,
                  padding: 0,
                  borderRadius: "var(--r-pill)",
                }}
                onClick={() => setIsPlaying((v) => !v)}
                title={isPlaying ? "Pause replay" : "Play replay"}
              >
                {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
              </button>

              <input
                type="range"
                min={0}
                max={timestamps.length - 1}
                value={index}
                onChange={(e) => {
                  setIsPlaying(false);
                  setIndex(parseInt(e.target.value, 10));
                }}
                style={{ flex: 1 }}
                aria-label="Historical snapshot timeline slider"
              />

              <div className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text)", minWidth: 180, textAlign: "right" }}>
                {parseTimestamp(timestamps[index]).toLocaleString([], { hour12: false })}
              </div>
            </div>

            <div className="hazard-filter-row">
              <span className="chip" style={{ background: "var(--accent)", color: "var(--on-accent)", fontWeight: 600 }}>
                Cycle {index + 1} / {timestamps.length}
              </span>
              {Object.entries(counts).map(([type, n]) => (
                <span key={type} className="chip">
                  <span className="dot" style={{ background: HAZARD_COLOR[type as keyof typeof HAZARD_COLOR] }} />
                  {type.toUpperCase()} ({n})
                </span>
              ))}
            </div>

            {!snapshot || snapshot.features.length === 0 ? (
              <div className="label mono" style={{ fontSize: "var(--fs-sm)", padding: "28px 0" }}>
                Zero hazards logged at this snapshot.
              </div>
            ) : (
              <table className="hazards-table" aria-label="Historical Hazards Log">
                <thead>
                  <tr>
                    <th>TYPE</th>
                    <th>SEVERITY</th>
                    <th>LOCATION</th>
                    <th>METRIC VALUE</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.features.flatMap((f, fi) =>
                    f.properties.hazards.map((h, hi) => {
                      const [lon, lat] = f.geometry.coordinates;
                      const location = f.properties.name || f.properties.station_id || `${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`;
                      const metric =
                        h.reflectivity_dbz !== undefined
                          ? `${h.reflectivity_dbz} dBZ`
                          : h.velocity_delta_ms !== undefined
                          ? `${h.velocity_delta_ms} m/s`
                          : "—";
                      const sevClass = h.severity === "high" ? "chip--high" : h.severity === "moderate" ? "chip--mod" : "chip--low";
                      return (
                        <tr key={`${fi}-${hi}`}>
                          <td>
                            <span className="type-chip">
                              <span className="dot" style={{ background: HAZARD_COLOR[h.type] }} />
                              {h.type.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span className={`chip ${sevClass}`}>{h.severity.toUpperCase()}</span>
                          </td>
                          <td style={{ color: "var(--text)" }}>{location}</td>
                          <td className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text)" }}>
                            {metric}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
