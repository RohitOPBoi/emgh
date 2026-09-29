import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Map as MaplibreMap, NavigationControl, type ErrorEvent, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapContext, useMeghMap } from "./MapContext";

export { useMeghMap };

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "esri-dark-canvas": {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Esri, HERE, Garmin, FAO, NOAA, USGS",
    },
    "esri-dark-reference": {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
    },
  },
  layers: [
    { id: "bg-fallback", type: "background", paint: { "background-color": "#101010" } },
    { id: "esri-dark-canvas-layer", type: "raster", source: "esri-dark-canvas" },
  ],
};

/** MapProvider renders no DOM of its own — it only owns the MapLibre
 * instance and hands out context. The actual map container is rendered by
 * <MapCanvas/>, which the app places wherever the map should visually live
 * (e.g. inside .map-area). Keeping these separate matters: an earlier
 * version had MapProvider render its own full-page wrapper div, which the
 * app's own layout then nested a second, unrelated wrapper inside — the
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
      center: [73.86, 18.5],
      zoom: 10.2,
    });
    mapRef.current = instance;
    instance.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    instance.on("load", () => setReady(true));

    let errorShown = false;
    instance.on("error", (e: ErrorEvent) => {
      if (errorShown) return;
      errorShown = true;
      const message = (e.error && (e.error.message || e.error.toString())) || "unknown error";
      console.error("[map error]", message);
      setTileError(`Basemap tiles failed to load (network/firewall may be blocking arcgisonline.com): ${message}`);
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
 * — its parent must be `position: relative` (or similar) since this fills
 * it via `position: absolute; inset: 0`. */
export function MapCanvas() {
  const { attachContainer } = useMeghMap();
  return <div ref={attachContainer} className="map-root" style={{ position: "absolute", inset: 0 }} />;
}
