// Types mirror the FastAPI backend's JSON responses (nowcast/api/main.py).
// Keep in sync manually - no shared schema generation in this project yet.

export type HazardType = "hail" | "downburst" | "cloudburst" | "lightning";
export type Severity = "low" | "moderate" | "high";

export interface Hazard {
  type: HazardType;
  severity: Severity;
  reflectivity_dbz?: number;
  velocity_delta_ms?: number;
  rainrate_mm_hr?: number;
  gradient_dbz_per_cell?: number;
  cells?: number;
  /** all-India detections carry the nearest district (backend districts_india.py) */
  district?: string;
  state?: string;
  source?: string;
}

export interface HazardFeatureProperties {
  station_id?: string;
  name?: string;
  hazards: Hazard[];
  ts_severity?: string;
  lightning_prob_cat?: string;
  timestamp?: string;
  lead_minutes?: number;
}

export interface HazardFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: HazardFeatureProperties;
}

export interface HazardsResponse {
  type: "FeatureCollection";
  features: HazardFeature[];
  lead_time_minutes: number;
  note?: string;
}

export interface StormCell {
  station_id: string;
  name?: string;
  lat: number;
  lon: number;
  bearing_deg: number;
  speed_kmh: number;
  distance_km: number;
  eta_minutes: number;
  hazards: Hazard[];
  motion_source: string;
}

export interface StormEtaResponse {
  cells: StormCell[];
}

export type Bbox = [number, number, number, number];

export interface RawLayer {
  id: string;
  label: string;
  bbox: Bbox;
  image: string;
  source: string;
}

export interface RawLayersResponse {
  layers: RawLayer[];
  note: string;
}

export interface WeatherLayer {
  id: "temperature" | "humidity" | "wind_speed" | "pressure" | "rainfall";
  label: string;
  unit: string;
  bbox: Bbox;
  vmin: number;
  vmax: number;
  image: string;
}

export interface WeatherLayersResponse {
  layers: WeatherLayer[];
  note: string;
  source: "ecmwf-opendata" | "synthetic";
}

export interface WindPoint {
  lat: number;
  lon: number;
  wind_speed_ms: number;
  wind_dir_deg: number;
}

export interface WindVectorsResponse {
  points: WindPoint[];
}

export interface RegionForecast {
  temperature_c: number;
  humidity_pct: number;
  wind_speed_ms: number;
  wind_dir_deg: number;
  pressure_hpa: number;
  lead_minutes: number;
  cloudburst_rainrate_mm_hr: number | null;
}

export interface AreaStat {
  min: number;
  mean: number;
  max: number;
}

export interface AreaForecast {
  temperature_c: AreaStat;
  humidity_pct: AreaStat;
  wind_speed_ms: AreaStat;
  pressure_hpa: AreaStat;
  cloudburst_rainrate_mm_hr: AreaStat | null;
  lead_minutes: number;
  bbox: Bbox;
}

export type ModelId = "pysteps" | "dgmr" | "smaat";

export interface ForecastSummary {
  available: boolean;
  reason?: string;
  timestamps_min?: number[];
  max_rainrate_mm_hr?: number[];
  mean_rainrate_mm_hr?: number[];
  max_intensity?: number[];
  mean_intensity?: number[];
  bbox?: Bbox;
  source?: string;
  note?: string;
}

export interface NowcastFrame {
  available: boolean;
  reason?: string;
  image?: string;
  bbox?: Bbox;
  lead_minutes?: number;
  source?: string;
  note?: string;
}

export interface HistoryTimestampsResponse {
  timestamps: string[];
}

export interface HistoryHazardsResponse {
  type: "FeatureCollection";
  features: HazardFeature[];
  timestamp: string;
  note: string;
}

export interface RegionsResponse {
  active: string;
  options: { key: string; name: string; bbox: Bbox }[];
}

export type SourceMode = "live" | "synthetic";

export interface SourceStatus {
  label: string;
  provider: string;
  mode: SourceMode;
  receiving: boolean;
}

export interface SystemStatus {
  sources: Record<"radar" | "lightning" | "satellite" | "model" | "stations", SourceStatus>;
  hazards: { total: number; by_type: Record<string, number>; updated_unix: number | null; error: string | null };
  storm_cells: number;
  models: {
    pysteps: { horizon_min: number; step_min: number };
    dgmr: { horizon_min: number; step_min: number };
    smaat: { horizon_min: number; available: boolean };
  };
  ingest_cycle_min: number;
  active_region: string;
  regions: number;
}

export interface RainField {
  bbox: Bbox;
  width: number;
  height: number;
  quant: number;
  encoding: "sqrt";
  /** base64 uint8 grid, row 0 = southern edge, mm/hr = (byte / quant) ** 2 */
  rate: string;
  wind: { width: number; height: number; u: number[]; v: number[] };
  lead_minutes: number;
  source: string;
  method: string;
  stats: { max_mm_hr: number; wet_fraction: number; very_heavy_cells: number };
  note: string | null;
}
