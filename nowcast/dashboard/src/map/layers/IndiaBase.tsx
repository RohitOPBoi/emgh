import { useEffect } from "react";
import { Marker, type GeoJSONSource } from "maplibre-gl";
import { useAgrimMap } from "../MapProvider";
import { api } from "../../api";

type Ring = number[][];
type PolyCoords = Ring[];

const STATE_NAME_FIX: Record<string, string> = {
  "Arunanchal Pradesh": "Arunachal Pradesh",
  "Dadara & Nagar Havelli": "Dadra & Nagar Haveli",
  "NCT of Delhi": "Delhi",
  "Andaman & Nicobar Island": "Andaman & Nicobar",
  "Jammu & Kashmir": "Jammu & Kashmir · Ladakh",
};

/** Signed area + centroid of a planar ring (degrees are fine at this scale). */
function ringStats(ring: Ring) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  a /= 2;
  return { area: Math.abs(a), cx: cx / (6 * a || 1), cy: cy / (6 * a || 1) };
}

/** Label anchor = centroid of the state's biggest polygon (islands and
 * enclaves shouldn't drag the label into the sea). */
function labelPoint(geom: GeoJSON.Geometry): { lon: number; lat: number; area: number } | null {
  const polys: PolyCoords[] =
    geom.type === "Polygon" ? [geom.coordinates as PolyCoords] : geom.type === "MultiPolygon" ? (geom.coordinates as PolyCoords[]) : [];
  let best: { lon: number; lat: number; area: number } | null = null;
  let total = 0;
  for (const p of polys) {
    const s = ringStats(p[0]);
    total += s.area;
    if (!best || s.area > best.area) best = { lon: s.cx, lat: s.cy, area: s.area };
  }
  return best ? { ...best, area: total } : null;
}

function graticule(step = 5): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let lon = 60; lon <= 105; lon += step)
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[lon, 0], [lon, 42]] } });
  for (let lat = 5; lat <= 40; lat += step)
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[58, lat], [108, lat]] } });
  return { type: "FeatureCollection", features };
}

/** The India-registered vector base: dimmed world mask with an India-shaped
 * hole, glowing official outline, state borders, graticule, and DOM place
 * labels (no glyph server needed). Works fully offline. Mount it last among
 * the map layer siblings so borders render above every data layer. */
export function IndiaBase({
  onSelectLocation,
}: {
  onSelectLocation?: (lat: number, lon: number) => void;
} = {}) {
  const { map, ready } = useAgrimMap();

  useEffect(() => {
    if (!map || !ready) return;
    let cancelled = false;
    let onZoom: (() => void) | null = null;
    const markers: Marker[] = [];

    (async () => {
      const [outlineRes, statesRes] = await Promise.all([
        fetch("/geo/india-outline.json").then((r) => r.json()),
        fetch("/geo/india-states.json").then((r) => r.json()) as Promise<GeoJSON.FeatureCollection>,
      ]);
      if (cancelled) return;

      // 1. World mask with India cut out ------------------------------------
      const outlineGeom: GeoJSON.Geometry =
        outlineRes.type === "GeometryCollection" ? outlineRes.geometries[0] : outlineRes.features?.[0]?.geometry ?? outlineRes;
      const polys: PolyCoords[] =
        outlineGeom.type === "MultiPolygon" ? (outlineGeom.coordinates as PolyCoords[]) : [(outlineGeom as GeoJSON.Polygon).coordinates as PolyCoords];
      const world: Ring = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
      (map.getSource("india-mask") as GeoJSONSource | undefined)?.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [world, ...polys.map((p) => p[0])] },
      });
      (map.getSource("india-graticule") as GeoJSONSource | undefined)?.setData(graticule());

      // 2. Borders + glowing outline on top of the data layers --------------
      if (!map.getSource("india-outline")) {
        map.addSource("india-outline", { type: "geojson", data: { type: "Feature", properties: {}, geometry: outlineGeom } });
      }
      if (!map.getLayer("india-states-line")) {
        map.addLayer({
          id: "india-states-line",
          type: "line",
          source: "india-states",
          paint: {
            "line-color": "#dbeaff",
            "line-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.16, 7, 0.34],
            "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 8, 1.1],
          },
        });
        map.addLayer({
          id: "india-outline-glow",
          type: "line",
          source: "india-outline",
          paint: { "line-color": "#63c2ff", "line-opacity": 0.22, "line-width": 5, "line-blur": 5 },
        });
        map.addLayer({
          id: "india-outline-line",
          type: "line",
          source: "india-outline",
          paint: { "line-color": "#e3f4ff", "line-opacity": 0.85, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.9, 8, 1.8] },
        });
      }

      // 3. State + city labels ----------------------------------------------
      for (const f of statesRes.features) {
        const pt = labelPoint(f.geometry);
        if (!pt) continue;
        const raw = String((f.properties as { name?: string })?.name ?? "");
        // MapLibre owns the marker root's inline style (opacity/transform), so
        // all of our styling lives on an inner element.
        const el = document.createElement("div");
        const inner = document.createElement("span");
        inner.className = "map-label map-label--state" + (pt.area < 2.5 ? " map-label--minor" : "");
        inner.textContent = STATE_NAME_FIX[raw] ?? raw;
        inner.style.cursor = "pointer";
        inner.title = `Click to inspect ${STATE_NAME_FIX[raw] ?? raw} telemetry`;
        inner.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onSelectLocation) {
            onSelectLocation(pt.lat, pt.lon);
          } else {
            map.flyTo({ center: [pt.lon, pt.lat], zoom: 6.5, duration: 800 });
          }
        });
        el.appendChild(inner);
        markers.push(new Marker({ element: el, anchor: "center" }).setLngLat([pt.lon, pt.lat]).addTo(map));
      }
      // Label density follows zoom (band classes on the map container).
      const container = map.getContainer();
      const applyBand = () => {
        const z = map.getZoom();
        container.classList.toggle("z-states", z >= 3.8);
        container.classList.toggle("z-minor", z >= 6.2);
        container.classList.toggle("z-cities", z >= 3.8);
        container.classList.toggle("z-citytext", z >= 5.5);
      };
      applyBand();
      map.on("zoom", applyBand);
      onZoom = applyBand;

      // City markers come from the API (never hard-coded); a slow or absent
      // backend must not hold up the borders and state labels above.
      const regions = await api.regions().catch(() => null);
      if (cancelled) {
        markers.forEach((m) => m.remove());
        return;
      }
      for (const r of regions?.options ?? []) {
        const [x0, y0, x1, y1] = r.bbox;
        const cLon = (x0 + x1) / 2;
        const cLat = (y0 + y1) / 2;
        const el = document.createElement("div");
        const inner = document.createElement("span");
        inner.className = "map-label map-label--city";
        inner.style.cursor = "pointer";
        inner.title = `Click to zoom into ${r.name} nowcast sector`;
        const dot = document.createElement("i");
        const text = document.createElement("b");
        text.textContent = r.name;
        inner.append(dot, text);
        inner.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onSelectLocation) {
            onSelectLocation(cLat, cLon);
          } else {
            map.flyTo({ center: [cLon, cLat], zoom: 9.5, duration: 800 });
          }
        });
        el.appendChild(inner);
        markers.push(new Marker({ element: el, anchor: "left", offset: [-4, 0] }).setLngLat([cLon, cLat]).addTo(map));
      }

    })().catch((e) => console.error("[india-base]", e));

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      if (onZoom) map.off("zoom", onZoom);
    };
  }, [map, ready]);

  return null;
}
