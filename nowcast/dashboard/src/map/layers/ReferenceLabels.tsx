import { useEffect } from "react";
import { useMeghMap } from "../MapProvider";

/** Place names / roads must render above data layers to stay legible — this
 * component's effect must run after the other layer-adding effects, so keep
 * it mounted last among map layer siblings in App.tsx. */
export function ReferenceLabels() {
  const { map, ready } = useMeghMap();
  useEffect(() => {
    if (!map || !ready || map.getLayer("esri-dark-reference-layer")) return;
    map.addLayer({ id: "esri-dark-reference-layer", type: "raster", source: "esri-dark-reference" });
  }, [map, ready]);
  return null;
}
