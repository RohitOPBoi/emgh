import { useEffect } from "react";
import type { Map as MaplibreMap, ImageSource } from "maplibre-gl";
import { bboxToCoords } from "../lib/colors";
import type { Bbox } from "../types";

/** Adds (or updates in place) a single image-raster layer. Shared by
 * satellite/radar overlays, the pySTEPS/DGMR model-frame overlay, and the
 * temperature/humidity/wind rasters — they only differ in id/image/bbox. */
export function useRasterLayer(
  map: MaplibreMap | null,
  layerId: string,
  image: string | undefined,
  bbox: Bbox | undefined,
  options: { opacity?: number; visible?: boolean; beforeId?: string } = {},
) {
  const { opacity = 0.5, visible = true, beforeId } = options;
  const sourceId = "src-" + layerId;

  useEffect(() => {
    if (!map || !image || !bbox) return;

    const coords = bboxToCoords(bbox);
    const existing = map.getSource(sourceId) as ImageSource | undefined;
    if (existing) {
      existing.updateImage({ url: image, coordinates: coords });
    } else {
      map.addSource(sourceId, { type: "image", url: image, coordinates: coords });
      map.addLayer(
        {
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: { "raster-opacity": opacity },
        },
        map.getLayer(beforeId ?? "") ? beforeId : undefined,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, image, bbox?.join(",")]);

  useEffect(() => {
    if (!map || !map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }, [map, visible, layerId]);
}
