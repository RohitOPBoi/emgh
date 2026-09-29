import { useEffect, useRef } from "react";
import type { MapMouseEvent } from "maplibre-gl";
import { useMeghMap } from "./MapProvider";
import type { Bbox } from "../types";

/** Click-drag-release rectangle select, active only while `active` is true.
 * Disables the map's own drag-to-pan for the duration so a drag draws a box
 * instead of panning the camera; re-enables it on cleanup regardless of how
 * the drag ended. `onDrawing` fires continuously with the live rectangle for
 * a visual preview, `onSelect` fires once on mouseup with the final bbox. */
export function useAreaDrag(
  active: boolean,
  onDrawing: (bbox: Bbox | null) => void,
  onSelect: (bbox: Bbox) => void
) {
  const { map, ready } = useMeghMap();
  const startRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!map || !ready || !active) return;

    map.dragPan.disable();
    map.getCanvas().style.cursor = "crosshair";

    const toBbox = (a: { lng: number; lat: number }, b: { lng: number; lat: number }): Bbox => [
      Math.min(a.lng, b.lng),
      Math.min(a.lat, b.lat),
      Math.max(a.lng, b.lng),
      Math.max(a.lat, b.lat),
    ];

    const onDown = (e: MapMouseEvent) => {
      startRef.current = { lat: e.lngLat.lat, lng: e.lngLat.lng };
    };
    const onMove = (e: MapMouseEvent) => {
      if (!startRef.current) return;
      onDrawing(toBbox(startRef.current, { lat: e.lngLat.lat, lng: e.lngLat.lng }));
    };
    const onUp = (e: MapMouseEvent) => {
      if (!startRef.current) return;
      const bbox = toBbox(startRef.current, { lat: e.lngLat.lat, lng: e.lngLat.lng });
      startRef.current = null;
      onDrawing(null);
      // a click with no meaningful drag isn't a useful area — ignore it
      if (bbox[2] - bbox[0] < 0.01 || bbox[3] - bbox[1] < 0.01) return;
      onSelect(bbox);
    };

    map.on("mousedown", onDown);
    map.on("mousemove", onMove);
    map.on("mouseup", onUp);
    return () => {
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
      map.off("mousedown", onDown);
      map.off("mousemove", onMove);
      map.off("mouseup", onUp);
      startRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, active]);
}
