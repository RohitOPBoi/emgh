import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Map as MaplibreMap, NavigationControl, type ErrorEvent, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapContext, useAgrimMap } from "./MapContext";
import { INDIA_BOUNDS } from "../lib/india";

export { useAgrimMap };

/** Camera never leaves the subcontinent neighbourhood. */
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [55, -4],
  [111, 44],
];

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// Layer order matters: the vector India base sits under every data layer
// (added later by the layer components) and its borders/labels are re-added
// on top by <IndiaBase/> once data layers exist. Nothing here needs a
// network round-trip except the optional Esri relief tiles - if those are
// blocked the map still renders complete and correctly aligned.
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "esri-dark-canvas": {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 16,
      attribution: "Esri, HERE, Garmin, FAO, NOAA, USGS",
    },
    "esri-dark-reference": {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 16,
    },
    "india-states": { type: "geojson", data: "/geo/india-states.json" },
    "india-mask": { type: "geojson", data: EMPTY },
    "india-graticule": { type: "geojson", data: EMPTY },
  },
  layers: [
    { id: "bg-fallback", type: "background", paint: { "background-color": "#050912" } },
    {
      id: "esri-dark-canvas-layer",
      type: "raster",
      source: "esri-dark-canvas",
      paint: { "raster-opacity": 0.72, "raster-saturation": -0.35, "raster-brightness-max": 0.85 },
    },
    {
      id: "india-land",
      type: "fill",
      source: "india-states",
      paint: { "fill-color": "#0f1b2e", "fill-opacity": 0.5 },
    },
    {
      id: "india-graticule-line",
      type: "line",
      source: "india-graticule",
      paint: { "line-color": "#7fa6d6", "line-opacity": 0.1, "line-width": 0.6 },
    },
    {
      id: "india-mask-fill",
      type: "fill",
      source: "india-mask",
      paint: { "fill-color": "#03060c", "fill-opacity": 0.62 },
    },
  ],
};

/** MapProvider renders no DOM of its own - it only owns the MapLibre
 * instance and hands out context. The actual map container is rendered by
 * <MapCanvas/>, which the app places wherever the map should visually live
 * (e.g. inside .map-area). Keeping these separate matters: an earlier
 * version had MapProvider render its own full-page wrapper div, which the
 * app's own layout then nested a second, unrelated wrapper inside - the
 * app's non-positioned flex content ended up stacking (and catching clicks)
 * above the absolutely-positioned map canvas, silently swallowing every
 * map click. Letting the caller control exactly where <MapCanvas/> sits
 * avoids that class of bug entirely. */
export function MapProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<MaplibreMap | null>(null);
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);

  const attachContainer = useCallback((el: HTMLDivElement | null) => {
    if (!el || mapRef.current) return;

    const instance = new MaplibreMap({
      container: el,
      style: STYLE,
      bounds: INDIA_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      maxBounds: MAX_BOUNDS,
      minZoom: 3.2,
      maxZoom: 15,
      attributionControl: { compact: true },
    });
    mapRef.current = instance;
    instance.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    // "style.load" (not "load"): "load" waits on every initial raster tile, so a
    // slow/blocked relief-tile server would hold the whole overlay stack hostage.
    instance.once("style.load", () => setReady(true));

    let errorShown = false;
    instance.on("error", (e: ErrorEvent) => {
      if (errorShown) return;
      errorShown = true;
      const message = (e.error && (e.error.message || e.error.toString())) || "unknown error";
      console.error("[map error]", message);
      setTileError(`Relief tiles unavailable (arcgisonline.com unreachable) - showing the built-in India vector base map. ${message}`);
    });

    setMap(instance);
  }, []);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <MapContext.Provider value={{ map, ready, tileError, attachContainer }}>{children}</MapContext.Provider>
  );
}

/** Renders the actual map canvas. Place exactly where the map should fill
 * - its parent must be `position: relative` (or similar) since this fills
 * it via `position: absolute; inset: 0`. */
export function MapCanvas() {
  const { attachContainer } = useAgrimMap();
  return <div ref={attachContainer} className="map-root" style={{ position: "absolute", inset: 0 }} />;
}
