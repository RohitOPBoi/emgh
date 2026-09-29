import { useEffect, useState } from "react";
import { X, Cpu } from "lucide-react";
import { api } from "../api";
import { useForecastSummary } from "../hooks/useNowcastData";
import { TrendChart } from "./TrendChart";
import type { ModelId, NowcastFrame } from "../types";

const MODEL_META: Record<ModelId, { label: string; desc: string; unit: string; max: number; step: number }> = {
  pysteps: {
    label: "PYSTEPS",
    desc: "Optical-flow Lucas-Kanade + semi-Lagrangian extrapolation. Calibrated mm/hr, 0–6h horizon.",
    unit: " mm/hr",
    max: 360,
    step: 10,
  },
  dgmr: {
    label: "DGMR",
    desc: "DeepMind Skillful Nowcasting GAN zero-shot. Relative intensity, 0–90min horizon.",
    unit: "",
    max: 90,
    step: 5,
  },
  smaat: {
    label: "SMAAT-UNET",
    desc: "Spatial-Channel Attention UNet. High-resolution convective storm prediction, 0–60min horizon.",
    unit: " mm/hr",
    max: 60,
    step: 10,
  },
};

function ModelColumn({ model }: { model: ModelId }) {
  const meta = MODEL_META[model];
  const forecast = useForecastSummary(model);
  const [leadMinutes, setLeadMinutes] = useState(0);
  const [frame, setFrame] = useState<NowcastFrame | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.nowcastFrame(model, leadMinutes).then((f) => !cancelled && setFrame(f));
    return () => {
      cancelled = true;
    };
  }, [model, leadMinutes]);

  const values = forecast.data?.max_rainrate_mm_hr ?? forecast.data?.max_intensity;
  const trendPoints =
    forecast.data?.timestamps_min && values
      ? forecast.data.timestamps_min.map((t, i) => ({ leadMin: t, value: values[i] }))
      : [];
  const leadLabel = leadMinutes === 0 ? "NOW" : `+${Math.floor(leadMinutes / 60)}h ${leadMinutes % 60 ? `${leadMinutes % 60}m` : ""}`;

  return (
    <div
      className="panel"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-3)",
      }}
    >
      <div className="section-title">
        <span style={{ fontSize: "var(--fs-md)", color: "var(--text)" }}>{meta.label}</span>
        <span className="count" style={{ color: "var(--text)" }}>
          0–{meta.max}m
        </span>
      </div>
      <div className="label" style={{ lineHeight: 1.5 }}>
        {meta.desc}
      </div>

      {forecast.data?.available === false ? (
        <div className="label mono" style={{ color: "var(--high)" }}>
          UNAVAILABLE: {forecast.data.reason}
        </div>
      ) : (
        <>
          <div className="label mono">
            MAX {model === "pysteps" ? "RAIN RATE" : "INTENSITY"} OVER HORIZON
          </div>
          {trendPoints.length > 1 ? (
            <TrendChart points={trendPoints} color="var(--radar-3)" unit={meta.unit} height={80} />
          ) : (
            <div className="label mono" style={{ padding: "12px 0" }}>
              AWAITING TENSOR STREAM…
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <div
              className="mono"
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "var(--text-3)",
                marginBottom: 6,
              }}
            >
              <span>PREVIEW LEAD TIME</span>
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{leadLabel}</span>
            </div>
            <input
              type="range"
              min={0}
              max={meta.max}
              step={meta.step}
              value={leadMinutes}
              onChange={(e) => setLeadMinutes(parseInt(e.target.value, 10))}
              aria-label={`Preview lead time for ${meta.label}`}
            />
          </div>

          {frame?.image && (
            <div
              style={{
                marginTop: 10,
                border: "1px solid var(--line)",
                borderRadius: "var(--r-tile)",
                overflow: "hidden",
                background: "var(--map)",
              }}
            >
              <img
                src={frame.image}
                alt={`${meta.label} at +${leadMinutes}m`}
                style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ForecastPage({ onClose }: { onClose: () => void }) {
  return (
    <div className="hazards-page" role="dialog" aria-label="Model Comparison">
      <div className="hazards-page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Cpu size={18} style={{ color: "var(--text-3)" }} />
          <h1>Nowcast Model Benchmark & Cross-Validation</h1>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close page" style={{ width: 32, height: 32 }}>
          <X size={16} />
        </button>
      </div>

      <div className="hazards-page-body">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--s-4)" }}>
          <ModelColumn model="pysteps" />
          <ModelColumn model="dgmr" />
          <ModelColumn model="smaat" />
        </div>
      </div>
    </div>
  );
}
