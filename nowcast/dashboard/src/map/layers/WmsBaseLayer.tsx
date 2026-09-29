import { useEffect } from "react";
import { useMeghMap } from "../MapContext";
import { BASE_LAYERS, wmsTileUrl } from "../../lib/mosdacLayers";

/** Real MOSDAC/Bhuvan base imagery, selectable in place of the default Esri
 * dark-gray canvas. "none" means keep Esri. Only one is ever visible; all
 * are added once (hidden) so switching is instant, not a re-fetch. */
export function WmsBaseLayer({ selectedId }: { selectedId: string }) {
  const { map, ready } = useMeghMap();

  useEffect(() => {
    if (!map || !ready) return;
    for (const def of BASE_LAYERS) {
      const layerId = "wms-base-" + def.id;
      if (map.getLayer(layerId)) continue;
      map.addSource(layerId, { type: "raster", tiles: [wmsTileUrl(def)], tileSize: 256 });
      // added right after the Esri canvas (bottom of the stack) — every
      // later layer (heatmaps, overlays, reference labels) mounts above it
      map.addLayer(
        { id: layerId, type: "raster", source: layerId, layout: { visibility: "none" }, paint: { "raster-opacity": 1 } },
        "esri-dark-canvas-layer",
      );
    }
  }, [map, ready]);

  useEffect(() => {
    if (!map) return;
    for (const def of BASE_LAYERS) {
      const layerId = "wms-base-" + def.id;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", def.id === selectedId ? "visible" : "none");
      }
    }
    if (map.getLayer("esri-dark-canvas-layer")) {
      map.setLayoutProperty("esri-dark-canvas-layer", "visibility", selectedId === "none" ? "visible" : "none");
    }
  }, [map, selectedId]);

  return null;
}
