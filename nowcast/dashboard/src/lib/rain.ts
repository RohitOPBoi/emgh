import type { Bbox, RainField } from "../types";

/** Operational rain-rate classes (mm/hr). 15 mm/hr is the "very heavy rain"
 * boundary the backend uses for cloudburst warnings (settings.py). */
export const RAIN_CLASSES = [
  { min: 0.5, label: "Light", color: "#4db3ff" },
  { min: 2.5, label: "Moderate", color: "#3a7bff" },
  { min: 7.5, label: "Heavy", color: "#8a5cff" },
  { min: 15, label: "Very heavy", color: "#d64dff" },
  { min: 30, label: "Extreme", color: "#ff5fc0" },
] as const;

export function rainClass(rate: number) {
  let cls: (typeof RAIN_CLASSES)[number] | null = null;
  for (const c of RAIN_CLASSES) if (rate >= c.min) cls = c;
  return cls;
}

// [rate mm/hr, r, g, b, alpha] — cool blue -> violet -> magenta -> white-hot.
const STOPS: [number, number, number, number, number][] = [
  [0.1, 70, 170, 255, 0.0],
  [0.6, 70, 175, 255, 0.34],
  [2.5, 45, 125, 255, 0.62],
  [5, 70, 95, 255, 0.74],
  [7.5, 125, 85, 255, 0.8],
  [15, 205, 75, 255, 0.86],
  [30, 255, 85, 195, 0.92],
  [50, 255, 195, 235, 0.95],
  [65, 255, 255, 255, 0.98],
];

export function rateColor(rate: number): [number, number, number, number] {
  if (rate <= STOPS[0][0]) return [0, 0, 0, 0];
  for (let i = 1; i < STOPS.length; i++) {
    if (rate <= STOPS[i][0]) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const t = (rate - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t, a[4] + (b[4] - a[4]) * t];
    }
  }
  const last = STOPS[STOPS.length - 1];
  return [last[1], last[2], last[3], last[4]];
}

export interface DecodedRain {
  bbox: Bbox;
  w: number;
  h: number;
  /** mm/hr, row 0 = southern edge */
  rate: Float32Array;
  wind: { w: number; h: number; u: Float32Array; v: Float32Array };
  meta: RainField;
}

export function decodeRain(f: RainField): DecodedRain {
  const bin = atob(f.rate);
  const rate = new Float32Array(f.width * f.height);
  for (let i = 0; i < rate.length; i++) {
    const q = bin.charCodeAt(i) / f.quant;
    rate[i] = q * q;
  }
  return {
    bbox: f.bbox,
    w: f.width,
    h: f.height,
    rate,
    wind: { w: f.wind.width, h: f.wind.height, u: Float32Array.from(f.wind.u), v: Float32Array.from(f.wind.v) },
    meta: f,
  };
}

function bilinear(arr: Float32Array, w: number, h: number, fx: number, fy: number) {
  const x = Math.min(Math.max(fx, 0), w - 1);
  const y = Math.min(Math.max(fy, 0), h - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const tx = x - x0;
  const ty = y - y0;
  const a = arr[y0 * w + x0] * (1 - tx) + arr[y0 * w + x1] * tx;
  const b = arr[y1 * w + x0] * (1 - tx) + arr[y1 * w + x1] * tx;
  return a * (1 - ty) + b * ty;
}

/** Bilinear rain rate at a geographic point; 0 outside the field's bbox. */
export function sampleRate(d: DecodedRain, lon: number, lat: number): number {
  const [x0, y0, x1, y1] = d.bbox;
  if (lon < x0 || lon > x1 || lat < y0 || lat > y1) return 0;
  return bilinear(d.rate, d.w, d.h, ((lon - x0) / (x1 - x0)) * (d.w - 1), ((lat - y0) / (y1 - y0)) * (d.h - 1));
}

/** Wind (m/s, blowing toward) at a geographic point. */
export function sampleWind(d: DecodedRain, lon: number, lat: number): [number, number] {
  const [x0, y0, x1, y1] = d.bbox;
  const fx = Math.min(Math.max((lon - x0) / (x1 - x0), 0), 1) * (d.wind.w - 1);
  const fy = Math.min(Math.max((lat - y0) / (y1 - y0), 0), 1) * (d.wind.h - 1);
  return [bilinear(d.wind.u, d.wind.w, d.wind.h, fx, fy), bilinear(d.wind.v, d.wind.w, d.wind.h, fx, fy)];
}

/** Smooth, upsampled RGBA rendering of the field for the map image layer.
 * Drawn north-up (canvas row 0 = north), i.e. flipped from the data grid. */
export function renderFieldCanvas(d: DecodedRain, maxSide = 720): HTMLCanvasElement {
  const aspect = (d.bbox[2] - d.bbox[0]) / (d.bbox[3] - d.bbox[1]);
  const W = aspect >= 1 ? maxSide : Math.round(maxSide * aspect);
  const H = aspect >= 1 ? Math.round(maxSide / aspect) : maxSide;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const fy = (1 - y / (H - 1)) * (d.h - 1); // north-up
    for (let x = 0; x < W; x++) {
      const r = bilinear(d.rate, d.w, d.h, (x / (W - 1)) * (d.w - 1), fy);
      const [cr, cg, cb, ca] = rateColor(r);
      const i = (y * W + x) * 4;
      img.data[i] = cr;
      img.data[i + 1] = cg;
      img.data[i + 2] = cb;
      img.data[i + 3] = ca * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export interface RainCell {
  lon: number;
  lat: number;
  rate: number;
}

/** Local maxima of the field (3x3 non-maximum suppression with a minimum
 * separation), strongest first — the "storm cores" the UI calls out. */
export function findCells(d: DecodedRain, count = 6, minRate = 8, sepCells = Math.max(5, Math.round(Math.max(d.w, d.h) * 0.14))): RainCell[] {
  const peaks: { x: number; y: number; v: number }[] = [];
  for (let y = 1; y < d.h - 1; y++) {
    for (let x = 1; x < d.w - 1; x++) {
      const v = d.rate[y * d.w + x];
      if (v < minRate) continue;
      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++)
        for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && d.rate[(y + dy) * d.w + x + dx] > v) { isMax = false; break; }
      if (isMax) peaks.push({ x, y, v });
    }
  }
  peaks.sort((a, b) => b.v - a.v);
  const chosen: typeof peaks = [];
  for (const p of peaks) {
    if (chosen.every((c) => Math.hypot(c.x - p.x, c.y - p.y) >= sepCells)) chosen.push(p);
    if (chosen.length >= count) break;
  }
  const [x0, y0, x1, y1] = d.bbox;
  return chosen.map((p) => ({
    lon: x0 + (p.x / (d.w - 1)) * (x1 - x0),
    lat: y0 + (p.y / (d.h - 1)) * (y1 - y0),
    rate: p.v,
  }));
}
