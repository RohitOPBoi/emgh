import { useEffect } from "react";
import type { Feature } from "geojson";
import { useMeghMap } from "../MapProvider";
import type { WindPoint } from "../../types";

function createArrowIcon(size: number): ImageData {
  // Locally-drawn SDF arrow instead of a text glyph — avoids depending on an
  // external glyphs font server (fonts.openmaptiles.org has returned
  // malformed PBFs for some font-stack/range combos in testing, logged by
  // MapLibre as "Unimplemented type: 4", silently dropping the layer).
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  const c = size / 2;
  ctx.beginPath();
  ctx.moveTo(c, 1);
  ctx.lineTo(c + size * 0.28, size - 3);
  ctx.lineTo(c, size * 0.62);
  ctx.lineTo(c - size * 0.28, size - 3);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

export function WindArrows({ points, visible }: { points: WindPoint[] | null; visible: boolean }) {
  const { map, ready } = useMeghMap();

  useEffect(() => {
    if (!map || !ready || !points || map.getSource("wind-arrows")) return;

    const features: Feature[] = points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: { dir: p.wind_dir_deg, speed: p.wind_speed_ms },
    }));
    map.addSource("wind-arrows", { type: "geojson", data: { type: "FeatureCollection", features } });
    if (!map.hasImage("wind-arrow-icon")) {
      map.addImage("wind-arrow-icon", createArrowIcon(28), { sdf: true });
    }
    map.addLayer({
      id: "wind-arrow-layer",
      type: "symbol",
      source: "wind-arrows",
      layout: {
        "icon-image": "wind-arrow-icon",
        "icon-size": ["interpolate", ["linear"], ["get", "speed"], 2, 0.4, 16, 0.9],
        "icon-rotate": ["get", "dir"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        visibility: visible ? "visible" : "none",
      },
      paint: { "icon-color": "#e5edf7", "icon-opacity": 0.9 },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, points]);

  useEffect(() => {
    if (!map || !map.getLayer("wind-arrow-layer")) return;
    map.setLayoutProperty("wind-arrow-layer", "visibility", visible ? "visible" : "none");
  }, [map, visible]);

  return null;
}
