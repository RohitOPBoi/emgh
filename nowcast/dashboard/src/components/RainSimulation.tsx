import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloudLightning, CloudRain, Crosshair, Layers, X } from "lucide-react";
import { useAgrimMap } from "../map/MapContext";
import { INDIA_BOUNDS } from "../lib/india";
import { useRasterLayer } from "../map/useRasterLayer";
import { api } from "../api";
import { RAIN_CLASSES, decodeRain, findCells, rainClass, renderFieldCanvas, sampleRate, sampleWind, type DecodedRain, type RainCell } from "../lib/rain";

export interface Strike {
  lon: number;
  lat: number;
}

interface Props {
  leadMinutes: number;
  strikes: Strike[];
  onClose: () => void;
  /** Where to mount the control card (the right dock's slot). Falls back to a
   * floating card on the map when the dock is collapsed. */
  hudTarget?: HTMLElement | null;
}

interface Options {
  particles: boolean;
  field: boolean;
  cells: boolean;
  lightning: boolean;
  gain: number;
}

const GRID_PX = 20; // screen-space lookup cell
const MAX_PARTICLES = 5200;
const RATE_REF = 10; // mm/hr at which spawn probability saturates
const BUCKET_COLORS = ["#8fd0ff", "#6aa8ff", "#a684ff", "#dc7bff", "#ffa3e0"];
const bucketOf = (r: number) => (r < 2.5 ? 0 : r < 7.5 ? 1 : r < 15 ? 2 : r < 30 ? 3 : 4);

interface Grid {
  gw: number;
  gh: number;
  rate: Float32Array;
  slant: Float32Array; // px of horizontal drift per px of fall
}

function leadLabel(min: number) {
  if (min === 0) return "NOW";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `+${h ? `${h}h` : ""}${m ? ` ${m}m` : ""}`.trim();
}

/** Rain simulation: the API's rain-rate field drawn as (1) a smooth
 * intensity layer on the map and (2) a screen-space particle system - * falling streaks whose density and length follow the local rain rate and
 * whose slant follows the local wind - plus splashes, real-strike lightning
 * and callouts for the strongest cells. */
export function RainSimulation({ leadMinutes, strikes, onClose, hudTarget }: Props) {
  const { map } = useAgrimMap();
  const [field, setField] = useState<DecodedRain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opts, setOpts] = useState<Options>({ particles: true, field: true, cells: true, lightning: true, gain: 1 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Data: refetch on lead-time change (debounced) and every 3 minutes ──────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        const f = await api.rainField(leadMinutes);
        if (cancelled) return;
        setField(decodeRain(f));
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "rain field unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const debounce = setTimeout(load, 220);
    const poll = setInterval(load, 180_000);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
      clearInterval(poll);
    };
  }, [leadMinutes]);

  // ── Map field layer (smooth, offline-safe) ─────────────────────────────────
  const fieldUrl = useMemo(() => (field ? renderFieldCanvas(field).toDataURL("image/png") : undefined), [field]);
  useRasterLayer(map, "layer-rain-sim", fieldUrl, field?.bbox, {
    opacity: 0.92,
    visible: opts.field,
    beforeId: "india-states-line",
  });

  // Regional fallback (no all-India radar): frame the region the field covers,
  // and restore the national view when the simulation is closed.
  const regional = field ? field.bbox[2] - field.bbox[0] < 10 : false;
  const bboxKey = field?.bbox.join(",");
  useEffect(() => {
    if (!map || !field || !regional) return;
    const [x0, y0, x1, y1] = field.bbox;
    map.fitBounds([[x0, y0], [x1, y1]], { padding: map.getPadding(), duration: 900 });
    return () => {
      map.fitBounds(INDIA_BOUNDS, { padding: map.getPadding(), duration: 700 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, regional, bboxKey]);

  const cells: RainCell[] = useMemo(() => (field ? findCells(field) : []), [field]);

  // ── Engine ─────────────────────────────────────────────────────────────────
  const live = useRef({ field, opts, strikes, cells });
  live.current = { field, opts, strikes, cells };
  const gridRef = useRef<Grid | null>(null);

  const rebuildGrid = useCallback(() => {
    const canvas = canvasRef.current;
    const f = live.current.field;
    if (!map || !canvas || !f) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const gw = Math.ceil(w / GRID_PX);
    const gh = Math.ceil(h / GRID_PX);
    const rate = new Float32Array(gw * gh);
    const slant = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const p = map.unproject([i * GRID_PX + GRID_PX / 2, j * GRID_PX + GRID_PX / 2]);
        const r = sampleRate(f, p.lng, p.lat);
        rate[j * gw + i] = r;
        if (r > 0.3) slant[j * gw + i] = sampleWind(f, p.lng, p.lat)[0] * 0.035;
      }
    }
    gridRef.current = { gw, gh, rate, slant };
  }, [map]);

  useEffect(() => {
    rebuildGrid();
  }, [field, rebuildGrid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!map || !canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const fit = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildGrid();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    let moveQueued = false;
    const onMove = () => {
      if (moveQueued) return;
      moveQueued = true;
      requestAnimationFrame(() => {
        moveQueued = false;
        rebuildGrid();
      });
    };
    map.on("move", onMove);

    // Particle pool (structure-of-arrays for cheap iteration)
    const N = MAX_PARTICLES;
    const px = new Float32Array(N);
    const py = new Float32Array(N);
    const vy = new Float32Array(N);
    const len = new Float32Array(N);
    const ttl = new Float32Array(N);
    const sl = new Float32Array(N);
    const layer = new Uint8Array(N);
    const bucket = new Uint8Array(N);
    const alive = new Uint8Array(N);
    const splashes: { x: number; y: number; age: number; b: number }[] = [];
    let bolt: { pts: number[][]; branches: number[][][]; age: number; x: number; y: number } | null = null;
    let nextBolt = 1.2;
    let flash = 0;
    let last = performance.now();
    let clock = 0;
    let raf = 0;

    const makeBolt = (x: number, y: number) => {
      const pts: number[][] = [];
      let cx = x + (Math.random() - 0.5) * 30;
      let cy = y - 130 - Math.random() * 90;
      const branches: number[][][] = [];
      pts.push([cx, cy]);
      while (cy < y) {
        cy += 11 + Math.random() * 16;
        cx += (Math.random() - 0.5) * 34 + (x - cx) * 0.08;
        pts.push([cx, Math.min(cy, y)]);
        if (Math.random() < 0.22 && cy < y - 40) {
          const br: number[][] = [[cx, cy]];
          let bx = cx;
          let by = cy;
          const dir = Math.random() < 0.5 ? -1 : 1;
          for (let k = 0; k < 4; k++) {
            by += 12 + Math.random() * 16;
            bx += dir * (8 + Math.random() * 16);
            br.push([bx, by]);
          }
          branches.push(br);
        }
      }
      return { pts, branches, age: 0, x, y };
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      clock += dt;
      const { field: f, opts: o, strikes: st, cells: cs } = live.current;
      const g = gridRef.current;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      ctx.clearRect(0, 0, W, H);
      if (!f || !g) return;
      const zoom = map.getZoom();

      // ── Rain streaks ─────────────────────────────────────────────────────
      if (o.particles && !reduce) {
        const target = Math.min(N, Math.floor((W * H) / 190));
        for (let i = 0; i < target; i++) {
          if (!alive[i]) {
            for (let t = 0; t < 3; t++) {
              const x = Math.random() * W;
              const y = Math.random() * H;
              const gi = Math.floor(y / GRID_PX) * g.gw + Math.floor(x / GRID_PX);
              const r = g.rate[gi];
              if (r < 0.4) continue;
              if (Math.random() > Math.pow(Math.min(1, (r * o.gain) / RATE_REF), 0.65)) continue;
              const L = Math.random() < 0.34 ? 0 : Math.random() < 0.6 ? 1 : 2;
              layer[i] = L;
              bucket[i] = bucketOf(r);
              px[i] = x;
              py[i] = y;
              vy[i] = [420, 700, 1020][L] * (0.85 + Math.random() * 0.3);
              len[i] = ([6, 10, 16][L] + Math.min(r, 40) * 0.18) * (0.8 + Math.random() * 0.4);
              ttl[i] = 0.09 + Math.random() * 0.2; // short fall: rain stays under its own cell
              sl[i] = g.slant[gi];
              alive[i] = 1;
              break;
            }
          }
        }
        // integrate + draw, batched per (bucket, layer) stroke
        for (let b = 0; b < 5; b++) {
          for (let L = 0; L < 3; L++) {
            ctx.beginPath();
            let any = false;
            for (let i = 0; i < target; i++) {
              if (!alive[i] || bucket[i] !== b || layer[i] !== L) continue;
              const dy = vy[i] * dt;
              px[i] += dy * sl[i];
              py[i] += dy;
              ttl[i] -= dt;
              if (ttl[i] <= 0 || py[i] > H + 20) {
                alive[i] = 0;
                if (L >= 1 && zoom >= 5.2 && b >= 1 && splashes.length < 220) splashes.push({ x: px[i], y: py[i], age: 0, b });
                continue;
              }
              ctx.moveTo(px[i], py[i]);
              ctx.lineTo(px[i] - len[i] * sl[i], py[i] - len[i]);
              any = true;
            }
            if (any) {
              ctx.strokeStyle = BUCKET_COLORS[b];
              ctx.globalAlpha = [0.28, 0.5, 0.82][L];
              ctx.lineWidth = [0.7, 1, 1.5][L];
              ctx.lineCap = "round";
              ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 1;

        // ground splashes
        for (let s = splashes.length - 1; s >= 0; s--) {
          const sp = splashes[s];
          sp.age += dt * 3.2;
          if (sp.age >= 1) {
            splashes.splice(s, 1);
            continue;
          }
          ctx.beginPath();
          ctx.ellipse(sp.x, sp.y, 2 + sp.age * 9, (2 + sp.age * 9) * 0.34, 0, 0, Math.PI * 2);
          ctx.strokeStyle = BUCKET_COLORS[sp.b];
          ctx.globalAlpha = (1 - sp.age) * 0.55;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // ── Lightning (real strikes only) ────────────────────────────────────
      if (o.lightning && st.length > 0 && !reduce) {
        nextBolt -= dt;
        if (nextBolt <= 0 && !bolt) {
          const pick = st[Math.floor(Math.random() * st.length)];
          const p = map.project([pick.lon, pick.lat]);
          if (p.x > 0 && p.x < W && p.y > 0 && p.y < H) bolt = makeBolt(p.x, p.y);
          nextBolt = 0.45 + Math.random() * 1.6;
        }
        if (bolt) {
          bolt.age += dt;
          const a = bolt.age < 0.06 ? 1 : bolt.age < 0.1 ? 0.25 : bolt.age < 0.16 ? 0.8 : Math.max(0, 1 - (bolt.age - 0.16) / 0.14);
          flash = Math.max(flash, a * 0.08);
          const glow = ctx.createRadialGradient(bolt.x, bolt.y, 0, bolt.x, bolt.y, 150);
          glow.addColorStop(0, `rgba(200,225,255,${0.5 * a})`);
          glow.addColorStop(1, "rgba(200,225,255,0)");
          ctx.fillStyle = glow;
          ctx.fillRect(bolt.x - 150, bolt.y - 150, 300, 300);
          ctx.strokeStyle = `rgba(235,246,255,${a})`;
          ctx.shadowColor = "#9fd2ff";
          ctx.shadowBlur = 14;
          ctx.lineWidth = 1.8;
          ctx.lineJoin = "round";
          ctx.beginPath();
          bolt.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
          ctx.lineWidth = 0.9;
          for (const br of bolt.branches) {
            ctx.beginPath();
            br.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
          }
          ctx.shadowBlur = 0;
          if (bolt.age > 0.32) bolt = null;
        }
        if (flash > 0.002) {
          ctx.fillStyle = `rgba(190,220,255,${flash})`;
          ctx.fillRect(0, 0, W, H);
          flash *= 0.86;
        }
      }

      // ── Storm-core callouts ──────────────────────────────────────────────
      if (o.cells) {
        ctx.font = "600 10.5px 'JetBrains Mono', monospace";
        let shown = 0;
        const taken: { x: number; y: number }[] = [];
        for (let k = 0; k < cs.length && shown < 4; k++) {
          const c = cs[k];
          const p = map.project([c.lon, c.lat]);
          if (p.x < 30 || p.x > W - 30 || p.y < 30 || p.y > H - 30) continue;
          if (taken.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 110)) continue; // no overlapping callouts
          taken.push({ x: p.x, y: p.y });
          shown++;
          const cls = rainClass(c.rate);
          const col = cls?.color ?? "#fff";
          const pulse = 0.5 + 0.5 * Math.sin(clock * 3 + k);
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.4;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 0.35 * (1 - pulse);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 10 + pulse * 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          const label = `CELL ${String.fromCharCode(65 + k)} · ${c.rate.toFixed(0)} MM/H`;
          const tw = ctx.measureText(label).width;
          const lx = p.x + 22;
          const ly = p.y - 22;
          ctx.strokeStyle = "rgba(255,255,255,0.55)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x + 5, p.y - 5);
          ctx.lineTo(lx - 4, ly + 2);
          ctx.lineTo(lx + tw + 4, ly + 2);
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.shadowColor = "#03060c";
          ctx.shadowBlur = 6;
          ctx.fillText(label, lx, ly - 3);
          ctx.fillStyle = col;
          ctx.fillText((cls?.label ?? "").toUpperCase(), lx, ly + 12);
          ctx.shadowBlur = 0;
        }
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      map.off("move", onMove);
    };
  }, [map, rebuildGrid]);

  const stats = field?.meta.stats;
  const cls = stats ? rainClass(stats.max_mm_hr) : null;
  const toggle = (k: keyof Omit<Options, "gain">) => setOpts((p) => ({ ...p, [k]: !p[k] }));

  const hud = (
      <section className={`rain-hud panel ${hudTarget ? "" : "rain-hud--floating"}`} role="region" aria-label="Rain simulation">
        <header className="rain-hud-head">
          <div className="rain-hud-title">
            <CloudRain size={15} />
            <span>Rain Simulation</span>
            <b className="mono">{leadLabel(leadMinutes)}</b>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close rain simulation" aria-label="Close rain simulation" style={{ width: 26, height: 26 }}>
            <X size={13} />
          </button>
        </header>

        <div className="rain-hud-body">
          <div className="rain-stats">
            <div>
              <span className="label mono">Peak rate</span>
              <strong className="rain-num" style={{ color: cls?.color }}>
                {stats ? stats.max_mm_hr.toFixed(0) : "-"}
                <small>mm/h</small>
              </strong>
            </div>
            <div>
              <span className="label mono">Raining</span>
              <strong className="rain-num">
                {stats ? Math.round(stats.wet_fraction * 100) : "-"}
                <small>% area</small>
              </strong>
            </div>
            <div>
              <span className="label mono">Very heavy</span>
              <strong className="rain-num">
                {stats ? stats.very_heavy_cells : "-"}
                <small>cells</small>
              </strong>
            </div>
          </div>

          <div className="rain-legend" aria-label="Rain rate scale">
            {RAIN_CLASSES.map((c) => (
              <span key={c.label} style={{ ["--c" as string]: c.color }}>
                <i />
                {c.label}
                <em>{c.min}+</em>
              </span>
            ))}
          </div>

          <div className="rain-toggles" role="group" aria-label="Simulation layers">
            <button aria-pressed={opts.particles} className={opts.particles ? "on" : ""} onClick={() => toggle("particles")}>
              <CloudRain size={12} /> Rainfall
            </button>
            <button aria-pressed={opts.field} className={opts.field ? "on" : ""} onClick={() => toggle("field")}>
              <Layers size={12} /> Intensity
            </button>
            <button aria-pressed={opts.cells} className={opts.cells ? "on" : ""} onClick={() => toggle("cells")}>
              <Crosshair size={12} /> Cells
            </button>
            <button
              aria-pressed={opts.lightning}
              className={opts.lightning ? "on" : ""}
              onClick={() => toggle("lightning")}
              title={strikes.length ? `${strikes.length} real strikes` : "No real strikes reported right now"}
            >
              <CloudLightning size={12} /> Strikes <em>{strikes.length}</em>
            </button>
          </div>

          <label className="rain-gain">
            <span className="label mono">Density</span>
            <input
              type="range"
              min={0.4}
              max={2.2}
              step={0.1}
              value={opts.gain}
              onChange={(e) => setOpts((p) => ({ ...p, gain: Number(e.target.value) }))}
              aria-label="Rain particle density"
            />
          </label>

          <p className="rain-note mono">
            {error
              ? `Rain data unavailable - ${error}`
              : loading && !field
                ? "Loading rain field…"
                : `${field?.meta.method}${field?.meta.note ? ` · ${field.meta.note}` : ""} · source ${field?.meta.source}`}
          </p>
        </div>
      </section>
  );

  return (
    <>
      <canvas ref={canvasRef} className="rain-canvas" aria-hidden="true" />
      {hudTarget ? createPortal(hud, hudTarget) : hud}
    </>
  );
}
