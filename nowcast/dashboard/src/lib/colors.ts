import type { Bbox, Hazard, HazardType } from "../types";

export const HAZARD_COLOR: Record<HazardType, string> = {
  hail: "#f5b840",
  downburst: "#ff5a45",
  cloudburst: "#ece8da",
  lightning: "#ffe14d",
};

export const HAZARD_COLOR_RGB: Record<Exclude<HazardType, "lightning">, string> = {
  hail: "245,184,64",
  downburst: "255,90,69",
  cloudburst: "236,232,218",
};

export function colorForHazards(hazards: Hazard[]): string {
  if (hazards.some((h) => h.type === "downburst")) return HAZARD_COLOR.downburst;
  if (hazards.some((h) => h.type === "hail")) return HAZARD_COLOR.hail;
  if (hazards.some((h) => h.type === "cloudburst")) return HAZARD_COLOR.cloudburst;
  return HAZARD_COLOR.lightning;
}

// Severity levels: High (#ff5a45), Moderate (#f5b840), Low (#52c48f)
export const SEVERITY_COLOR: Record<string, string> = {
  low: "#52c48f",
  moderate: "#f5b840",
  high: "#ff5a45",
};

// Radar reflectivity: four discrete steps (10-25, 25-45, 45-55, 55+ dBZ)
export const RADAR_STEPS = [
  { dbz: "10–25", label: "Light", color: "#4e9f8f" },
  { dbz: "25–45", label: "Moderate", color: "#a4c85a" },
  { dbz: "45–55", label: "Heavy", color: "#f5b840" },
  { dbz: "55+", label: "Severe", color: "#ff5a45" },
] as const;

export const VAR_COLOR_STOPS: Record<string, [string, string, string]> = {
  temperature: ["#303331", "#f5b840", "#ff5a45"],
  humidity: ["#1d1f1e", "#4c504c", "#ece8da"],
  wind_speed: ["#1d1f1e", "#4e9f8f", "#ff5a45"],
  pressure: ["#ff5a45", "#4c504c", "#ece8da"],
  rainfall: ["#1d1f1e", "#4e9f8f", "#ff5a45"],
  composite_risk: ["#1d1f1e", "#f5b840", "#ff5a45"],
};

// Mirrors the vmin/vmax the backend uses for /weather-layers (main.py) so a
// value colored here (e.g. the area-select box fill) reads consistently
// with the main map overlay's legend, even when that overlay isn't active.
export const VAR_RANGE: Record<string, [number, number]> = {
  temperature: [18, 34],
  humidity: [0, 100],
  wind_speed: [0, 18],
  pressure: [995, 1015],
};

export function lerpColor(stops: readonly string[], t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const seg = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(seg));
  const localT = seg - i;
  const c1 = hexToRgb(stops[i]);
  const c2 = hexToRgb(stops[i + 1]);
  const rgb = c1.map((v, k) => Math.round(v + (c2[k] - v) * localT));
  return `rgb(${rgb.join(",")})`;
}

function hexToRgb(hex: string): number[] {
  const matches = hex.match(/\w\w/g) ?? [];
  return matches.map((h) => parseInt(h, 16));
}

export function bboxToCoords(bbox: Bbox): [[number, number], [number, number], [number, number], [number, number]] {
  const [lonMin, latMin, lonMax, latMax] = bbox;
  return [
    [lonMin, latMax],
    [lonMax, latMax],
    [lonMax, latMin],
    [lonMin, latMin],
  ];
}

export function windCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}
