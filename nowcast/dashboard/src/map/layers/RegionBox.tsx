import { useEffect } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { useMeghMap } from "../MapProvider";

const REGION_HALF_DEG = 0.15;

function regionBoxPolygon(lat: number, lon: number): FeatureCollection {
  const d = REGION_HALF_DEG;
  const coords = [
    [lon - d, lat + d],
    [lon + d, lat + d],
    [lon + d, lat - d],
    [lon - d, lat - d],
    [lon - d, lat + d],
  ];
  return { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} }] };
}

/** Dashed selection box drawn around a user-clicked region — must be the
 * topmost data layer so it's never hidden under a heatmap/raster overlay. */
export function RegionBox({ region }: { region: { lat: number; lon: number } | null }) {
  const { map, ready } = useMeghMap();

  useEffect(() => {
    if (!map || !ready || map.getSource("region-box")) return;
    map.addSource("region-box", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "region-box-line",
      type: "line",
      source: "region-box",
      paint: { "line-color": "#3fb6ff", "line-width": 2, "line-dasharray": [2, 2], "line-opacity": 0.9 },
    });
  }, [map, ready]);

  useEffect(() => {
    if (!map || !ready) return;
    const source = map.getSource("region-box") as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(region ? regionBoxPolygon(region.lat, region.lon) : { type: "FeatureCollection", features: [] });
  }, [map, ready, region]);

  return null;
}
