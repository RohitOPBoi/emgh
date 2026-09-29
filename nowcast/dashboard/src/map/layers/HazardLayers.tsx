import { useEffect, useRef } from "react";
import { Marker, Popup, type GeoJSONSource } from "maplibre-gl";
import type { Point } from "geojson";
import { useMeghMap } from "../MapProvider";
import { colorForHazards, SEVERITY_COLOR } from "../../lib/colors";
import type { HazardsResponse, HazardFeature, Hazard, HazardType } from "../../types";

const EMPTY_FC = { type: "FeatureCollection" as const, features: [] as HazardFeature[] };

function hazardDetail(h: Hazard): string {
  if (h.reflectivity_dbz !== undefined) return `${h.reflectivity_dbz} dBZ`;
  if (h.velocity_delta_ms !== undefined) return `${h.velocity_delta_ms} m/s`;
  if (h.rainrate_mm_hr !== undefined) return `${h.rainrate_mm_hr} mm/hr`;
  return "";
}

/** A glowing, pulsing ring animation (CSS, GPU-composited) around a solid
 * dot — reads as "a real, live event just detected here" rather than a
 * static marker. Built as an HTML Marker (not a MapLibre circle layer)
 * specifically because CSS keyframe animation is what gives the pulse for
 * free; a paint-property animation would need its own rAF loop per frame.
 * This replaced a heatmap here: that made sense for the old synthetic data
 * (100+ overlapping grid cells forming one storm shape), but real hail/
 * lightning right now is usually a handful of scattered points, which a
 * heatmap renders as faint, washed-out blobs instead of something that
 * actually draws the eye.
 *
 * Colored by severity (green/yellow/red), not hazard type — matches
 * hazard_india.py's reflectivity-based low/moderate/high tiers (lightning
 * is always "high": a real strike is an immediate hazard, not graded). */
function buildMarkerElement(severity: string): HTMLDivElement {
  const color = SEVERITY_COLOR[severity] ?? SEVERITY_COLOR.moderate;
  const el = document.createElement("div");
  el.className = `hazard-marker hazard-marker-${severity}`;
  el.style.setProperty("--hazard-color", color);
  el.innerHTML = `
    <span class="hazard-marker-ring"></span>
    <span class="hazard-marker-ring hazard-marker-ring-delay"></span>
    <span class="hazard-marker-dot"></span>
  `;
  return el;
}

/** Two independent toggles from the top toolbar apply here: `hailVisible`
 * (the "Hazards" button) hides/shows hail markers, `lightningVisible` (the
 * "Lightning" button) hides/shows lightning markers — each marker's own
 * type decides which toggle it listens to, so turning one off doesn't
 * touch the other. */
export function HazardLayers({
  hazards,
  hailVisible = true,
  lightningVisible = true,
}: {
  hazards: HazardsResponse | null;
  hailVisible?: boolean;
  lightningVisible?: boolean;
}) {
  const { map, ready } = useMeghMap();
  const popupRef = useRef<Popup | null>(null);
  const markersRef = useRef<{ marker: Marker; type: HazardType }[]>([]);
  const visibleByType = useRef<Record<string, boolean>>({ hail: hailVisible, lightning: lightningVisible });
  visibleByType.current = { hail: hailVisible, lightning: lightningVisible, downburst: hailVisible, cloudburst: hailVisible };

  useEffect(() => {
    if (!map || !ready) return;
    if (map.getSource("stations")) return; // already set up

    map.addSource("stations", { type: "geojson", data: EMPTY_FC });
    map.addLayer({
      id: "station-glow",
      type: "circle",
      source: "stations",
      paint: { "circle-radius": 16, "circle-color": ["get", "color"], "circle-opacity": 0.18, "circle-blur": 0.6 },
    });
    map.addLayer({
      id: "station-dot",
      type: "circle",
      source: "stations",
      paint: {
        "circle-radius": 6,
        "circle-color": ["get", "color"],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#0a0e16",
      },
    });

    map.on("mouseenter", "station-dot", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "station-dot", () => (map.getCanvas().style.cursor = ""));
    map.on("click", "station-dot", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as Record<string, string>;
      const hazardList = JSON.parse(p.hazards_json) as { type: string; severity: string }[];
      const rows = hazardList.map((h) => `<div class="popup-row"><b>${h.type}</b> — ${h.severity}</div>`).join("");
      popupRef.current?.remove();
      popupRef.current = new Popup({ closeButton: true, offset: 10 })
        .setLngLat((f.geometry as Point).coordinates as [number, number])
        .setHTML(
          `<div class="popup-title">${p.name || p.station_id}</div>${rows}
           <div class="popup-row">Severity: ${p.ts_severity || "—"}</div>
           <div class="popup-row">Lightning cat: ${p.lightning_prob_cat || "—"}</div>`,
        )
        .addTo(map);
    });
  }, [map, ready]);

  useEffect(() => {
    if (!map || !ready || !hazards) return;

    for (const { marker } of markersRef.current) marker.remove();
    markersRef.current = [];

    const stationFeatures: HazardFeature[] = [];

    for (const f of hazards.features) {
      if (f.properties.station_id) {
        stationFeatures.push({
          ...f,
          properties: {
            ...f.properties,
            // @ts-expect-error -- runtime-only fields consumed by paint expressions, not in the shared type
            color: colorForHazards(f.properties.hazards),
            hazards_json: JSON.stringify(f.properties.hazards),
          },
        });
        continue;
      }

      const [lon, lat] = f.geometry.coordinates;
      for (const h of f.properties.hazards) {
        const el = buildMarkerElement(h.severity);
        el.style.display = visibleByType.current[h.type] ? "" : "none";
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const detail = hazardDetail(h);
          popupRef.current?.remove();
          popupRef.current = new Popup({ closeButton: true, offset: 12 })
            .setLngLat([lon, lat])
            .setHTML(
              `<div class="popup-title">${h.type[0].toUpperCase()}${h.type.slice(1)}</div>
               <div class="popup-row">Severity: ${h.severity}</div>
               ${detail ? `<div class="popup-row">${detail}</div>` : ""}`,
            )
            .addTo(map);
        });
        const marker = new Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
        markersRef.current.push({ marker, type: h.type });
      }
    }

    (map.getSource("stations") as GeoJSONSource)?.setData({ type: "FeatureCollection", features: stationFeatures });
  }, [map, ready, hazards]);

  useEffect(() => {
    for (const { marker, type } of markersRef.current) {
      marker.getElement().style.display = visibleByType.current[type] ? "" : "none";
    }
  }, [hailVisible, lightningVisible]);

  useEffect(() => {
    return () => {
      for (const { marker } of markersRef.current) marker.remove();
    };
  }, []);

  return null;
}
