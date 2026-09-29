import { useEffect } from "react";
import { useMeghMap } from "../MapContext";
import { OVERLAY_LAYERS, wmsTileUrl } from "../../lib/mosdacLayers";

/** Real MOSDAC GIS reference overlays (roads, rivers, boundaries, hazard
 * susceptibility maps) — see lib/mosdacLayers.ts for provenance. Sits above
 * the base map/satellite/radar but below the hazard heatmaps and station
 * markers, so nowcast hazards stay the visual focus. */
export function WmsOverlayLayers({ activeIds }: { activeIds: Set<string> }) {
  const { map, ready } = useMeghMap();

  useEffect(() => {
    if (!map || !ready) return;
    for (const def of OVERLAY_LAYERS) {
      const layerId = "wms-overlay-" + def.id;
      if (map.getLayer(layerId)) continue;
      map.addSource(layerId, { type: "raster", tiles: [wmsTileUrl(def)], tileSize: 256 });
      const beforeId = map.getLayer("heat-hail") ? "heat-hail" : undefined;
      map.addLayer(
        { id: layerId, type: "raster", source: layerId, layout: { visibility: "none" }, paint: { "raster-opacity": 0.85 } },
        beforeId,
      );
    }
  }, [map, ready]);

  useEffect(() => {
    if (!map) return;
    for (const def of OVERLAY_LAYERS) {
      const layerId = "wms-overlay-" + def.id;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", activeIds.has(def.id) ? "visible" : "none");
      }
    }
  }, [map, activeIds]);

  return null;
}
