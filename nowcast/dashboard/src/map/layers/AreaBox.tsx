import { useEffect } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { useMeghMap } from "../MapProvider";
import type { Bbox } from "../../types";

function bboxPolygon(bbox: Bbox): FeatureCollection {
  const [lonMin, latMin, lonMax, latMax] = bbox;
  const coords = [
    [lonMin, latMax],
    [lonMax, latMax],
    [lonMax, latMin],
    [lonMin, latMin],
    [lonMin, latMax],
  ];
  return { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} }] };
}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

const DEFAULT_COLOR = "#3fb6ff";

/** User drag-drawn area selection — a live dashed preview while dragging,
 * then a solid box once confirmed. Separate source/layer from RegionBox
 * (the fixed-size click-to-inspect box) since both can't share one style.
 *
 * `fillColor`/`fillOpacity` let the box actually show something instead of
 * reading as an empty rectangle when there's no hazard inside it — the
 * area-inspect panel can pick a weather variable (temp/humidity/wind/
 * pressure) and color the box by that variable's average, same palette as
 * the main map's weather overlay, so "no hazards here" doesn't look like
 * "nothing happened". */
export function AreaBox({
  drawing,
  selected,
  fillColor,
  fillOpacity,
}: {
  drawing: Bbox | null;
  selected: Bbox | null;
  fillColor?: string;
  fillOpacity?: number;
}) {
  const { map, ready } = useMeghMap();

  useEffect(() => {
    if (!map || !ready || map.getSource("area-box")) return;
    map.addSource("area-box", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "area-box-fill",
      type: "fill",
      source: "area-box",
      paint: { "fill-color": DEFAULT_COLOR, "fill-opacity": 0.08 },
    });
    map.addLayer({
      id: "area-box-line",
      type: "line",
      source: "area-box",
      paint: { "line-color": DEFAULT_COLOR, "line-width": 2, "line-opacity": 0.9 },
    });
  }, [map, ready]);

  useEffect(() => {
    if (!map || !ready) return;
    const source = map.getSource("area-box") as GeoJSONSource | undefined;
    if (!source) return;
    const active = drawing ?? selected;
    source.setData(active ? bboxPolygon(active) : EMPTY);
    if (map.getLayer("area-box-line")) {
      map.setPaintProperty("area-box-line", "line-dasharray", drawing ? [2, 2] : [1, 0]);
    }
  }, [map, ready, drawing, selected]);

  useEffect(() => {
    if (!map || !ready || !map.getLayer("area-box-fill")) return;
    map.setPaintProperty("area-box-fill", "fill-color", fillColor ?? DEFAULT_COLOR);
    map.setPaintProperty("area-box-fill", "fill-opacity", drawing ? 0.08 : (fillOpacity ?? 0.08));
  }, [map, ready, fillColor, fillOpacity, drawing]);

  return null;
}
