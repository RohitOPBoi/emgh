/**
 * Real WMS layer catalog reverse-engineered from MOSDAC's own CloudBurst DSS
 * (https://www.mosdac.gov.in/cloudburst/ — "CloudBurst Alerts over Western
 * Himalayan Region"), the exact page the user copied this layer list from.
 *
 * Every id/layers value here was captured by driving that live page with a
 * real browser (Playwright), toggling each checkbox in isolation on a fresh
 * page load, and recording the resulting WMS GetMap request — then verified
 * again with a direct curl GetMap request returning HTTP 200 + a real PNG.
 * Nothing here is guessed. This is genuinely real ISRO/MOSDAC government GIS
 * data, not synthetic — unlike the rest of this project's hazard layers.
 *
 * MapLibre has no dedicated "WMS source" type; a raster source whose tile
 * URL contains the `{bbox-epsg-3857}` template variable is resolved
 * per-tile automatically, which is all a WMS GetMap request needs.
 */

import { API_BASE } from "../api";

export interface WmsLayerDef {
  id: string;
  label: string;
  /** WMS service base URL (no query string). */
  endpoint: string;
  /** The LAYERS param value exactly as MOSDAC's own client sends it — some
   * are single names, some are comma-joined with reference layers
   * (worldview_continent,boundary_merge) the way MOSDAC composites them. */
  layers: string;
  version?: "1.1.1" | "1.3.0";
}

const MOSDAC_GS = "https://www.mosdac.gov.in/geoserver_2";

export const OVERLAY_LAYERS: WmsLayerDef[] = [
  { id: "lulc", label: "LULC India (2018-19)", endpoint: `${MOSDAC_GS}/worldview/wms`, layers: "worldview:lulc250k_1819_18856" },
  { id: "sub_basins", label: "Sub Basins", endpoint: `${MOSDAC_GS}/weather_forecast/wms`, layers: "weather_forecast:Sub_Basins" },
  { id: "basins", label: "Basins", endpoint: `${MOSDAC_GS}/weather_forecast/wms`, layers: "weather_forecast:Basins" },
  { id: "landslide", label: "Land Slide", endpoint: `${MOSDAC_GS}/worldview/wms`, layers: "global_landslide,worldview_continent,boundary_merge" },
  { id: "fire_risk", label: "Fire Risk Map", endpoint: `${MOSDAC_GS}/worldview/wms`, layers: "fire_risk" },
  { id: "landslide_risk", label: "Landslide Risk Map", endpoint: `${MOSDAC_GS}/worldview/wms`, layers: "landslide_risk" },
  { id: "drainage_uk_hp", label: "Drainage UK & HP", endpoint: `${MOSDAC_GS}/forecast_india/wms`, layers: "forecast_india:hp_uk_drainage_srtm" },
  { id: "drainage", label: "Drainage", endpoint: `${MOSDAC_GS}/forecast_india/wms`, layers: "forecast_india:india_drainage_gtopo" },
  { id: "rivers", label: "Rivers", endpoint: `${MOSDAC_GS}/worldview/wms`, layers: "INDIA_RIVERS250NATGIS2005,worldview_continent,boundary_merge" },
  { id: "district_population", label: "District Population", endpoint: `${MOSDAC_GS}/worldview/wms`, layers: "worldview:INDIA_DISTRICT250NATGIS2005_pop,worldview_continent,boundary_merge" },
  { id: "railway_tracks", label: "Railway Tracks", endpoint: `${MOSDAC_GS}/worldview/wms`, layers: "worldview:INDIA_RAIL250NATGIS2005,worldview_continent,boundary_merge" },
  { id: "airports", label: "Airports", endpoint: `${MOSDAC_GS}/worldview/wms`, layers: "worldview:INDIA_AIRPORT250NATGIS2005,worldview_continent,boundary_merge" },
  { id: "district_roads", label: "District Roads", endpoint: `${MOSDAC_GS}/worldview/wms`, layers: "worldview:INDIA_DISTRD250NATGIS2005,worldview_continent,boundary_merge" },
  { id: "national_highways", label: "National Highways", endpoint: `${MOSDAC_GS}/worldview/wms`, layers: "INDIA_NHROAD250NATGIS2005,worldview_continent,boundary_merge" },
  { id: "taluka_boundaries", label: "Taluka Boundaries", endpoint: `${MOSDAC_GS}/worldview/wms`, layers: "taluka_boundary" },
  { id: "admin_boundaries", label: "Admin Boundaries", endpoint: `${MOSDAC_GS}/worldview/wms`, layers: "stateinfo_merged" },
];

export const BASE_LAYERS: WmsLayerDef[] = [
  { id: "lulc_india", label: "LULC (India)", endpoint: `${MOSDAC_GS}/worldview/wms`, layers: "worldview:lulc250k_1819_18856" },
  { id: "dem", label: "DEM", endpoint: `${MOSDAC_GS}/forecast_india/wms`, layers: "forecast_india:GTOPO_DEM" },
  // routed through our own backend (see /wms-proxy/bhuvan) — Bhuvan's WMS
  // server doesn't send CORS headers, so a browser can't fetch it directly
  // (confirmed: curl gets 200, browser fetch gets blocked by CORS)
  { id: "bhuvan", label: "Bhuvan Maps", endpoint: `${API_BASE}/wms-proxy/bhuvan`, layers: "india3" },
  { id: "osm", label: "Open Street Map", endpoint: "https://www.mosdac.gov.in/mapproxy/service", layers: "osm" },
  { id: "natural_earth", label: "Natural Earth", endpoint: `${MOSDAC_GS}/wms`, layers: "natural_earth" },
  { id: "black_marble", label: "Black Marble", endpoint: `${MOSDAC_GS}/wms`, layers: "black_marble" },
  { id: "true_marble", label: "True Marble", endpoint: `${MOSDAC_GS}/mosdacview/wms`, layers: "true_marble" },
];

export function wmsTileUrl(def: WmsLayerDef): string {
  const version = def.version ?? "1.1.1";
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: version,
    REQUEST: "GetMap",
    FORMAT: "image/png",
    TRANSPARENT: "true",
    WIDTH: "256",
    HEIGHT: "256",
    STYLES: "",
  });
  // LAYERS/BBOX/SRS appended manually: {bbox-epsg-3857} is MapLibre's own
  // per-tile template token and must stay literal, not URL-encoded.
  const srsKey = version === "1.3.0" ? "CRS" : "SRS";
  return `${def.endpoint}?${params.toString()}&LAYERS=${encodeURIComponent(def.layers)}&${srsKey}=EPSG:3857&BBOX={bbox-epsg-3857}`;
}
