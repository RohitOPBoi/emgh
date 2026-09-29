/** Documented system constants shown on the landing page. These mirror the
 * thresholds in nowcast/configs/settings.py (single source of truth on the
 * backend); the numeric *live* values on the page always come from the API. */
export const SPEC = {
  hail: { dbz: 55, coldTopK: 210, lightningProb: 0.3 },
  downburstDeltaV: 25,
  cloudburstMmHr: 15,
  horizonHours: 6,
  stepMin: 10,
} as const;

export const SIH = {
  edition: "SIH 2026",
  psId: "26072",
  org: "Ministry of Earth Sciences",
  dept: "India Meteorological Department",
  theme: "Disaster Management",
} as const;
