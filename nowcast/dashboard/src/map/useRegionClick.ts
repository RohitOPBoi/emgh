import { useEffect } from "react";
import type { MapMouseEvent } from "maplibre-gl";
import { useMeghMap } from "./MapProvider";

/** Fires `onSelect(lat, lon)` when the user clicks the map anywhere that
 * isn't a station marker (which has its own click handler for its popup).
 * `enabled` disables this entirely, e.g. while the drag-to-select-area tool
 * (useAreaDrag) is active — a click during a drag-drawn area shouldn't also
 * fire a point selection. */
export function useRegionClick(enabled: boolean, onSelect: (lat: number, lon: number) => void) {
  const { map, ready } = useMeghMap();

  useEffect(() => {
    if (!map || !ready || !enabled) return;

    const handler = (e: MapMouseEvent) => {
      const stationLayer = map.getLayer("station-dot") ? ["station-dot"] : [];
      const hits = stationLayer.length ? map.queryRenderedFeatures(e.point, { layers: stationLayer }) : [];
      if (hits.length) return;
      onSelect(e.lngLat.lat, e.lngLat.lng);
    };

    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, enabled]);
}
