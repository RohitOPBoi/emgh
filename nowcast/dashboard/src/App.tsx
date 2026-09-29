import { useEffect, useRef, useState, type CSSProperties } from "react";
import { MapProvider, MapCanvas, useAgrimMap } from "./map/MapProvider";
import { INDIA_BOUNDS } from "./lib/india";
import { IndiaBase } from "./map/layers/IndiaBase";
import { HazardLayers } from "./map/layers/HazardLayers";
import { SensorRasterLayers } from "./map/layers/SensorRasterLayers";
import { WeatherRasterLayers } from "./map/layers/WeatherRasterLayers";
import { WindArrows } from "./map/layers/WindArrows";
import { ModelFrameLayer } from "./map/layers/ModelFrameLayer";
import { RegionBox } from "./map/layers/RegionBox";
import { AreaBox } from "./map/layers/AreaBox";
import { WmsBaseLayer } from "./map/layers/WmsBaseLayer";
import { WmsOverlayLayers } from "./map/layers/WmsOverlayLayers";
import { useRegionClick } from "./map/useRegionClick";
import { useAreaDrag } from "./map/useAreaDrag";

import { TopBar } from "./components/TopBar";
import { Banner } from "./components/Banner";
import type { ActivePanel } from "./components/LeftNavigation";
import { HazardsPage } from "./components/HazardsPage";
import { ForecastPage } from "./components/ForecastPage";
import { ReplayPage } from "./components/ReplayPage";
import { LeftSidebar } from "./components/LeftSidebar";
import { RightSidebar } from "./components/RightSidebar";
import { BottomPanel } from "./components/BottomPanel";
import { LayersDrawer } from "./components/LayersDrawer";
import { RegionFloating } from "./components/RegionFloating";
import { RainSimulation, type Strike } from "./components/RainSimulation";
import { AreaFloating, type AreaVarId } from "./components/AreaFloating";
import { VAR_COLOR_STOPS, VAR_RANGE, lerpColor } from "./lib/colors";
import { Frame, BarChart2, CloudRain } from "lucide-react";
import { api, API_BASE, ApiError } from "./api";
import {
  useHazards,
  useStormEta,
  useRawLayers,
  useForecastSummary,
  useNowcastFrame,
  useWeatherLayers,
  useWindVectors,
} from "./hooks/useNowcastData";
import type { ModelId, RegionForecast, HazardsResponse, RawLayer, WeatherLayer, WindPoint, NowcastFrame, AreaForecast, Bbox } from "./types";

type VarId = "none" | "temperature" | "humidity" | "wind_speed" | "pressure" | "rainfall" | "composite_risk";

const LEAD_MAX = { pysteps: 360, dgmr: 90, smaat: 60 } as const;

function Dashboard() {
  const { map, tileError } = useAgrimMap();

  const [leadMinutes, setLeadMinutes] = useState(0);
  const [model, setModel] = useState<ModelId>("pysteps");
  // Satellite and the pySTEPS/DGMR model-frame overlay are still tied to
  // the small per-region demo bbox (no real all-India single-request
  // satellite source exists, and the model frame is inherently a
  // per-region forecast) - defaulting them off keeps the main view free of
  // any Pune-sized (or whichever city's) box unless someone explicitly
  // opts into the per-region demo layers via their toggles.
  const [satelliteVisible, setSatelliteVisible] = useState(false);
  const [radarVisible, setRadarVisible] = useState(true);
  const [heatmapsVisible, setHeatmapsVisible] = useState(true);
  const [lightningVisible, setLightningVisible] = useState(true);
  const [modelFrameVisible, setModelFrameVisible] = useState(false);
  const [activeVar, setActiveVar] = useState<VarId>("none");
  const [showLegend, setShowLegend] = useState(true);
  const [baseMapId, setBaseMapId] = useState("none");
  const [activeOverlayIds, setActiveOverlayIds] = useState<Set<string>>(new Set());
  const [region, setRegion] = useState<{ lat: number; lon: number } | null>(null);
  const [regionLeadMinutes, setRegionLeadMinutes] = useState(0);
  const [regionReading, setRegionReading] = useState<RegionForecast | null>(null);
  const [areaSelectMode, setAreaSelectMode] = useState(false);
  const [drawingArea, setDrawingArea] = useState<Bbox | null>(null);
  const [area, setArea] = useState<Bbox | null>(null);
  const [areaLeadMinutes, setAreaLeadMinutes] = useState(0);
  const [areaReading, setAreaReading] = useState<AreaForecast | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [areaLoading, setAreaLoading] = useState(false);
  const [areaVar, setAreaVar] = useState<AreaVarId>("none");
  const [activePanel, setActivePanel] = useState<ActivePanel>(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("panel");
      if (p === "hazards" || p === "forecast" || p === "replay" || p === "layers") return p;
    } catch {
      /* ignore */
    }
    return "none";
  });
  const [rainSimVisible, setRainSimVisible] = useState(false);
  const [rainSlot, setRainSlot] = useState<HTMLElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("play") === "1";
    } catch {
      return false;
    }
  });
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isCanvasMode, setIsCanvasMode] = useState(false);
  const [apiUnreachable, setApiUnreachable] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Dock geometry drives both CSS (timeline/toolbar centring) and the map
  // camera padding, so India always sits centred in the free map area.
  const DOCK_PX = 316; // dock width + gap
  const leftDockPx = activePanel === "layers" || !(leftCollapsed || isCanvasMode) ? DOCK_PX : 0;
  const rightDockPx = !(rightCollapsed || isCanvasMode) ? DOCK_PX : 0;

  const hazards = useHazards(leadMinutes);
  const stormEta = useStormEta();
  const rawLayers = useRawLayers();
  const forecastSummary = useForecastSummary(model);
  const nowcastFrame = useNowcastFrame(model, leadMinutes, modelFrameVisible);
  // Rainfall is now a normal /weather-layers entry (real, all-India, from
  // live radar via Z-R - see main.py) like temp/humidity/wind/pressure,
  // not a special case reusing the per-region pySTEPS frame - that used to
  // make "Rainfall" the one weather variable still secretly scoped to
  // whichever demo city was active.
  const weatherLayers = useWeatherLayers(leadMinutes, activeVar !== "none");
  const windVectors = useWindVectors(leadMinutes, activeVar === "wind_speed");
  const displayedWeatherLayers = weatherLayers.data?.layers ?? [];

  const totalHazards = (hazards.data?.features ?? []).reduce(
    (acc, f) => acc + (f.properties?.hazards?.length ?? 0),
    0
  );

  const strikes: Strike[] = (hazards.data?.features ?? [])
    .filter((f) => f.properties?.hazards?.some((h) => h.type === "lightning"))
    .map((f) => ({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));

  useEffect(() => {
    setApiUnreachable(Boolean(hazards.error && hazards.error.includes("Failed to fetch")));
    if (!hazards.error) setLastUpdated(new Date());
  }, [hazards.error, hazards.data]);

  // Default camera shows all of India, matching the default hazard/radar
  // view (both real, all-India - see hazard_india.py) - not whichever demo
  // city happens to be selected in the region picker, which only matters
  // for the separate Forecast/Replay pySTEPS/DGMR pages now. Runs once the
  // map's ready and doesn't fight the user's own panning/zooming afterward.
  const dockPadRef = useRef({ l: 0, r: 0 });
  useEffect(() => {
    if (!map) return;
    const pad = { left: leftDockPx + 8, right: rightDockPx + 8, top: 64, bottom: 100 };
    const first = dockPadRef.current.l === 0 && dockPadRef.current.r === 0 && !map.loaded();
    dockPadRef.current = { l: leftDockPx, r: rightDockPx };
    if (region || area) {
      map.setPadding(pad); // keep the user's zoom on a selected point/area
    } else {
      map.fitBounds(INDIA_BOUNDS, { padding: pad, duration: first ? 0 : 500 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, leftDockPx, rightDockPx]);

  // reset to a clean lead-time position whenever the model changes, since
  // DGMR's horizon (90min) is shorter than pySTEPS' (6h)
  useEffect(() => {
    setLeadMinutes(0);
  }, [model]);


  // simple auto-play: advance the lead-time slider one step per second
  const playRef = useRef({ model, leadMinutes });
  playRef.current = { model, leadMinutes };
  useEffect(() => {
    if (!isPlaying) return;
    const step = model === "dgmr" ? 15 : model === "smaat" ? 10 : 60;
    const id = setInterval(() => {
      const { model: m, leadMinutes: cur } = playRef.current;
      const max = LEAD_MAX[m];
      setLeadMinutes(cur + step > max ? 0 : cur + step);
    }, 1000);
    return () => clearInterval(id);
  }, [isPlaying, model]);

  useRegionClick(!areaSelectMode, (lat, lon) => selectRegion(lat, lon));
  useAreaDrag(areaSelectMode, setDrawingArea, (bbox) => selectArea(bbox));

  async function selectRegion(lat: number, lon: number) {
    setArea(null);
    setRegion({ lat, lon });
    setRegionLeadMinutes(0);
    setRegionReading(null);
    map?.flyTo({ center: [lon, lat], zoom: Math.min((map.getZoom() ?? 10) + 1.6, 13), duration: 800 });
    try {
      const reading = await api.regionForecast(lat, lon, 0);
      setRegionReading(reading);
    } catch {
      // region panel just stays in its loading state; not worth a banner for this
    }
  }

  async function onRegionLeadChange(m: number) {
    setRegionLeadMinutes(m);
    if (!region) return;
    try {
      const reading = await api.regionForecast(region.lat, region.lon, m);
      setRegionReading(reading);
    } catch {
      /* keep last known reading on transient failure */
    }
  }

  async function selectArea(bbox: Bbox) {
    setRegion(null);
    setAreaSelectMode(false);
    setArea(bbox);
    setAreaLeadMinutes(0);
    setAreaReading(null);
    setAreaError(null);
    setAreaLoading(true);
    const [lonMin, latMin, lonMax, latMax] = bbox;
    map?.fitBounds(
      [
        [lonMin, latMin],
        [lonMax, latMax],
      ],
      { padding: 80, duration: 800 }
    );
    try {
      // The first request in a while can genuinely take several seconds
      // when USE_LIVE_ECMWF is on: weather_fields.generate_grid() cold-
      // fetches three separate GRIB files from ECMWF before its in-process
      // cache is warm. areaLoading is what keeps the panel from looking
      // frozen during that wait.
      const reading = await api.areaForecast(bbox, 0);
      setAreaReading(reading);
    } catch (e) {
      console.error("[area-forecast] fetch failed", e);
      setAreaError(e instanceof ApiError ? `API ${e.status} on ${e.path}` : "request failed - see console");
    } finally {
      setAreaLoading(false);
    }
  }

  async function onAreaLeadChange(m: number) {
    setAreaLeadMinutes(m);
    if (!area) return;
    setAreaLoading(true);
    try {
      const reading = await api.areaForecast(area, m);
      setAreaReading(reading);
      setAreaError(null);
    } catch (e) {
      console.error("[area-forecast] fetch failed", e);
      setAreaError(e instanceof ApiError ? `API ${e.status} on ${e.path}` : "request failed - see console");
    } finally {
      setAreaLoading(false);
    }
  }

  function toggleOverlay(id: string) {
    setActiveOverlayIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeMeta = activeVar !== "none" ? displayedWeatherLayers.find((l) => l.id === activeVar) ?? null : null;

  // Colors the selected-area box by whichever variable the area panel picked
  // (temp/humidity/wind/pressure), using its mean over the area - same
  // palette/range as the main weather overlay's legend - so "no hazards
  // here" reads as "here's the actual weather", not an empty rectangle.
  const AREA_VAR_FIELD = {
    temperature: "temperature_c",
    humidity: "humidity_pct",
    wind_speed: "wind_speed_ms",
    pressure: "pressure_hpa",
  } as const;
  let areaFillColor: string | undefined;
  let areaFillOpacity: number | undefined;
  if (areaVar !== "none" && areaReading) {
    const stat = areaReading[AREA_VAR_FIELD[areaVar]];
    const [vmin, vmax] = VAR_RANGE[areaVar];
    const t = (stat.mean - vmin) / (vmax - vmin);
    areaFillColor = lerpColor(VAR_COLOR_STOPS[areaVar], t);
    areaFillOpacity = 0.45;
  }
  const dgmrUnavailable = forecastSummary.data?.available === false;
  const apiOk = !apiUnreachable && !hazards.error;
  const banner =
    (apiUnreachable ? `Can't reach the backend at ${API_BASE} - start it with: uvicorn nowcast.api.main:app --port 8000` : null);
  void tileError; // relief tiles are optional; the vector India base always renders

  return (
    <div className="app-shell">
      <div className="app-content">
        <TopBar
          activePanel={activePanel}
          onSelectPanel={setActivePanel}
          apiOk={apiOk}
          lastUpdated={lastUpdated}
          model={model}
          onModelChange={setModel}
          dgmrUnavailable={dgmrUnavailable}
          hazardCount={totalHazards}
          isCanvasMode={isCanvasMode}
          onToggleCanvasMode={() => {
            const next = !isCanvasMode;
            setIsCanvasMode(next);
            setLeftCollapsed(next);
            setRightCollapsed(next);
          }}
        />

        <div
          className="main-body"
          style={
            {
              "--left-dock": leftDockPx ? `${leftDockPx}px` : "0px",
              "--right-dock": rightDockPx ? `${rightDockPx}px` : "0px",
            } as CSSProperties
          }
        >
          {activePanel === "hazards" && (
            <HazardsPage
              hazards={hazards.data ?? null}
              stormCells={stormEta.data?.cells ?? null}
              onClose={() => setActivePanel("none")}
              onSelectLocation={(lat, lon) => {
                setActivePanel("none");
                selectRegion(lat, lon);
              }}
            />
          )}
          {activePanel === "forecast" && <ForecastPage onClose={() => setActivePanel("none")} />}
          {activePanel === "replay" && <ReplayPage onClose={() => setActivePanel("none")} />}

          {/* Dedicated Left Dock: Mutually exclusive, NEVER overlapping! */}
          {activePanel === "layers" ? (
            <LayersDrawer
              onClose={() => setActivePanel("none")}
              model={model}
              onModelChange={setModel}
              dgmrUnavailable={dgmrUnavailable}
              modelFrameVisible={modelFrameVisible}
              onModelFrameVisibleChange={setModelFrameVisible}
              baseMapId={baseMapId}
              onBaseMapChange={setBaseMapId}
              activeOverlayIds={activeOverlayIds}
              onOverlayToggle={toggleOverlay}
              activeVar={activeVar}
              onVarChange={setActiveVar}
              activeVarMeta={activeMeta}
              weatherSource={weatherLayers.data?.source ?? null}
            />
          ) : (
            <LeftSidebar
              hazards={hazards.data ?? null}
              model={model}
              apiOk={apiOk}
              lastUpdated={lastUpdated}
              collapsed={leftCollapsed || isCanvasMode}
              onToggleCollapse={() => setLeftCollapsed((v) => !v)}
              onOpenHazards={() => setActivePanel("hazards")}
            />
          )}

          <div className="map-area">
            <MapCanvas />
            <MapLayers
              hazards={hazards.data ?? null}
              heatmapsVisible={heatmapsVisible}
              lightningVisible={lightningVisible}
              rawLayers={rawLayers.data?.layers ?? null}
              satelliteVisible={satelliteVisible}
              radarVisible={radarVisible}
              weatherLayers={displayedWeatherLayers}
              activeVar={activeVar}
              windPoints={windVectors.data?.points ?? null}
              modelFrame={nowcastFrame.data ?? null}
              modelFrameVisible={modelFrameVisible}
              region={region}
              drawingArea={drawingArea}
              area={area}
              areaFillColor={areaFillColor}
              areaFillOpacity={areaFillOpacity}
              baseMapId={baseMapId}
              activeOverlayIds={activeOverlayIds}
              onSelectLocation={selectRegion}
            />

            {rainSimVisible && (
              <RainSimulation
                leadMinutes={leadMinutes}
                strikes={strikes}
                hudTarget={rightCollapsed || isCanvasMode ? null : rainSlot}
                onClose={() => setRainSimVisible(false)}
              />
            )}

            <div className="map-controls-top">
              <div className="layer-toggles" role="toolbar" aria-label="Map Layer Toggles">
                <button
                  className={`layer-btn ${radarVisible ? "active" : ""}`}
                  aria-pressed={radarVisible}
                  onClick={() => setRadarVisible((v) => !v)}
                >
                  <div className={`status-dot ${radarVisible ? "ok" : ""}`} /> RADAR
                </button>
                <button
                  className={`layer-btn ${satelliteVisible ? "active" : ""}`}
                  aria-pressed={satelliteVisible}
                  onClick={() => setSatelliteVisible((v) => !v)}
                >
                  <div className={`status-dot ${satelliteVisible ? "ok" : ""}`} /> SATELLITE
                </button>
                <button
                  className={`layer-btn ${lightningVisible ? "active" : ""}`}
                  aria-pressed={lightningVisible}
                  onClick={() => setLightningVisible((v) => !v)}
                >
                  <div className={`status-dot ${lightningVisible ? "ok" : ""}`} /> LIGHTNING
                </button>
                <button
                  className={`layer-btn ${heatmapsVisible ? "active" : ""}`}
                  aria-pressed={heatmapsVisible}
                  onClick={() => setHeatmapsVisible((v) => !v)}
                >
                  <div className={`status-dot ${heatmapsVisible ? "ok" : ""}`} /> HAZARDS
                </button>
                <button
                  className={`layer-btn ${baseMapId === "dem" ? "active" : ""}`}
                  aria-pressed={baseMapId === "dem"}
                  onClick={() => setBaseMapId((v) => (v === "dem" ? "none" : "dem"))}
                >
                  <div className={`status-dot ${baseMapId === "dem" ? "ok" : ""}`} /> TERRAIN
                </button>
                <button
                  className={`layer-btn layer-btn--rain ${rainSimVisible ? "active" : ""}`}
                  aria-pressed={rainSimVisible}
                  onClick={() => setRainSimVisible((v) => !v)}
                  title="Simulate rainfall over India - follows the lead-time slider"
                >
                  <CloudRain size={11} /> RAIN SIM
                </button>
                <button
                  className={`layer-btn ${areaSelectMode ? "active" : ""}`}
                  aria-pressed={areaSelectMode}
                  onClick={() => {
                    setRegion(null);
                    setArea(null);
                    setAreaSelectMode((v) => !v);
                  }}
                  title="Drag on the map to select an area and see its current + forecast stats"
                >
                  <Frame size={11} /> {areaSelectMode ? "DRAWING…" : "SELECT AREA"}
                </button>
                <button
                  className={`layer-btn ${showLegend ? "active" : ""}`}
                  aria-pressed={showLegend}
                  onClick={() => setShowLegend((v) => !v)}
                  title="Show/hide Reflectivity and Severity Legends"
                >
                  <BarChart2 size={11} /> LEGEND
                </button>
              </div>
            </div>

            {/* Floating Point & Area Inspection Card: Placed in UPPER RIGHT - NEVER overlaps bottom timeline! */}
            {(region || area) && (
              <div
                className="region-floating-wrapper"
                style={{
                  top: 70,
                  right: (rightCollapsed || isCanvasMode) ? 14 : 344,
                }}
              >
                {region ? (
                  <RegionFloating
                    region={region}
                    reading={regionReading}
                    leadMinutes={regionLeadMinutes}
                    onLeadChange={onRegionLeadChange}
                    onClose={() => setRegion(null)}
                  />
                ) : (
                  <AreaFloating
                    bbox={area!}
                    reading={areaReading}
                    loading={areaLoading}
                    error={areaError}
                    leadMinutes={areaLeadMinutes}
                    onLeadChange={onAreaLeadChange}
                    hazardCount={hazardsInBbox(hazards.data, area!)}
                    areaVar={areaVar}
                    onAreaVarChange={setAreaVar}
                    onClose={() => setArea(null)}
                    onRecenter={(b) => {
                      map?.fitBounds(
                        [
                          [b[0], b[1]],
                          [b[2], b[3]],
                        ],
                        { padding: 80, duration: 800 }
                      );
                    }}
                  />
                )}
              </div>
            )}

            <Banner message={banner} />
          </div>

          <RightSidebar
            stormCells={stormEta.data?.cells ?? null}
            forecast={forecastSummary.data ?? null}
            collapsed={rightCollapsed || isCanvasMode}
            onToggleCollapse={() => setRightCollapsed((v) => !v)}
            showLegend={showLegend}
            onToggleLegend={() => setShowLegend((v) => !v)}
            activeVarMeta={activeMeta}
            slotRef={setRainSlot}
          />

          <BottomPanel
            model={model}
            leadMinutes={leadMinutes}
            onLeadChange={setLeadMinutes}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying((v) => !v)}
            forecast={forecastSummary.data ?? null}
            hazards={hazards.data ?? null}
            onOpenReplay={() => setActivePanel("replay")}
          />
        </div>
      </div>
    </div>
  );
}

function MapLayers(props: {
  hazards: HazardsResponse | null;
  heatmapsVisible: boolean;
  lightningVisible: boolean;
  rawLayers: RawLayer[] | null;
  satelliteVisible: boolean;
  radarVisible: boolean;
  weatherLayers: WeatherLayer[] | null;
  activeVar: VarId;
  windPoints: WindPoint[] | null;
  modelFrame: NowcastFrame | null;
  modelFrameVisible: boolean;
  region: { lat: number; lon: number } | null;
  drawingArea: Bbox | null;
  area: Bbox | null;
  areaFillColor?: string;
  areaFillOpacity?: number;
  baseMapId: string;
  activeOverlayIds: Set<string>;
  onSelectLocation?: (lat: number, lon: number) => void;
}) {
  return (
    <>
      <WmsBaseLayer selectedId={props.baseMapId} />
      <HazardLayers
        hazards={props.hazards}
        hailVisible={props.heatmapsVisible}
        lightningVisible={props.lightningVisible}
        onSelectLocation={props.onSelectLocation}
      />
      <WmsOverlayLayers activeIds={props.activeOverlayIds} />
      <SensorRasterLayers layers={props.rawLayers} satelliteVisible={props.satelliteVisible} radarVisible={props.radarVisible} />
      <WeatherRasterLayers layers={props.weatherLayers} activeVar={props.activeVar} />
      <WindArrows points={props.windPoints} visible={props.activeVar === "wind_speed"} />
      <ModelFrameLayer frame={props.modelFrame} visible={props.modelFrameVisible} />
      <RegionBox region={props.region} />
      <AreaBox drawing={props.drawingArea} selected={props.area} fillColor={props.areaFillColor} fillOpacity={props.areaFillOpacity} />
      <IndiaBase onSelectLocation={props.onSelectLocation} />
    </>
  );
}

function hazardsInBbox(hazards: HazardsResponse | null, bbox: Bbox): number {
  if (!hazards) return 0;
  const [lonMin, latMin, lonMax, latMax] = bbox;
  return hazards.features.filter((f) => {
    const [lon, lat] = f.geometry.coordinates;
    return lon >= lonMin && lon <= lonMax && lat >= latMin && lat <= latMax;
  }).length;
}

export default function App() {
  return (
    <MapProvider>
      <Dashboard />
    </MapProvider>
  );
}
