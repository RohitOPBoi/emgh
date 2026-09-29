import { useState, useEffect, useRef } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Shield,
  CloudRain,
  Activity,
  Cpu,
  ChevronDown,
  Layers,
  Flame,
  Radio,
  Clock,
  Compass,
  Wind,
  Radar,
  AlertTriangle,
  Database,
  Sliders,
  Send,
  Sparkles,
} from "lucide-react";
import AtmosphericViewport from "./components/landing/AtmosphericViewport";
import AtmosphericWaveforms from "./components/landing/AtmosphericWaveforms";
import AtmosphericParticles from "./components/landing/AtmosphericParticles";
import LandingNav from "./components/landing/LandingNav";

gsap.registerPlugin(ScrollTrigger);

interface HomePageProps {
  onNavigateToDashboard: () => void;
}

export default function HomePage({ onNavigateToDashboard }: HomePageProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeTier, setActiveTier] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      touchMultiplier: 1.3,
    });
    lenisRef.current = lenis;

    lenis.on("scroll", () => {
      ScrollTrigger.update();
    });

    const updateTicker = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(updateTicker);
    gsap.ticker.lagSmoothing(0);

    let st: ScrollTrigger | null = null;
    if (containerRef.current) {
      st = ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.1,
        onUpdate: (self) => {
          const p = self.progress;
          setScrollProgress(p);

          if (p < 0.26) {
            setActiveTier(0);
          } else if (p < 0.54) {
            setActiveTier(1);
          } else if (p < 0.80) {
            setActiveTier(2);
          } else {
            setActiveTier(3);
          }
        },
      });
    }

    return () => {
      if (st) st.kill();
      gsap.ticker.remove(updateTicker);
      lenis.destroy();
    };
  }, []);

  const handleScrollToTier = (tierIndex: number) => {
    if (!containerRef.current || !lenisRef.current) return;
    const scrollTargets = [0, 0.38, 0.68, 0.98];
    const totalScrollable = containerRef.current.offsetHeight - window.innerHeight;
    const targetY = scrollTargets[tierIndex] * totalScrollable;
    lenisRef.current.scrollTo(targetY, { duration: 1.4 });
  };

  const p = scrollProgress;

  // ── VISIBILITY & DIRECTIONAL SLIDING (Plateaus for 100% Legibility) ──────
  // Act 1: Cosmic Hero
  const act1Opacity = p < 0.20 ? 1 : Math.max(0, 1 - (p - 0.20) / 0.08);
  const act1SlideY = prefersReducedMotion ? 0 : -Math.max(0, (p - 0.16) / 0.12) * 50;

  // Act 2: Stratospheric Flight Pipeline (Scale & Float)
  const act2Opacity = Math.max(0, Math.min((p - 0.22) / 0.08, (0.56 - p) / 0.08));
  const act2SlideY = prefersReducedMotion ? 0 : (0.32 - Math.min(0.50, Math.max(0.24, p))) * 120;

  // Act 3: Severe Weather Hazard Bento (Tactical Lateral Entry)
  const act3Opacity = Math.max(0, Math.min((p - 0.52) / 0.08, (0.80 - p) / 0.08));
  const act3SlideY = prefersReducedMotion ? 0 : (0.64 - Math.min(0.76, Math.max(0.54, p))) * 100;

  // Act 4: Aerospace Mission Control Console (Epicenter Lock-in)
  const act4Opacity = Math.max(0, Math.min(1, (p - 0.78) / 0.08));
  const act4SlideY = prefersReducedMotion ? 0 : Math.max(0, (0.90 - p) / 0.10) * 45;

  return (
    <div className="atm-landing-page" ref={containerRef}>
      <style>{BOLD_CREATIVE_LANDING_STYLES}</style>

      {/* 4 Exact Reference Images Photographic Viewport with RAW HAZARD FILTER */}
      <AtmosphericViewport
        scrollProgress={scrollProgress}
        prefersReducedMotion={prefersReducedMotion}
      />

      {/* Animated Subtle Wave-Forms & Acoustic Radar Spectrogram */}
      <AtmosphericWaveforms
        scrollProgress={scrollProgress}
        prefersReducedMotion={prefersReducedMotion}
      />

      {/* Persistent Snowy Atmosphere Drift & Lightning Flashes */}
      <AtmosphericParticles
        scrollProgress={scrollProgress}
        prefersReducedMotion={prefersReducedMotion}
      />

      {/* Aerospace Top Navigation with Animated Doppler Radar Logo */}
      <LandingNav
        onNavigateToDashboard={onNavigateToDashboard}
        onScrollToTier={handleScrollToTier}
        activeTier={activeTier}
      />

      {/* Atmospheric Height Telemetry HUD (Fixed Left) */}
      <div className="atm-hud-strip" aria-hidden="true">
        <div className="atm-hud-marker">
          <span className="atm-hud-mono">ALTITUDE</span>
          <span className="atm-hud-val">
            {scrollProgress < 0.26
              ? "36,000 KM"
              : scrollProgress < 0.54
                ? "11,400 M"
                : scrollProgress < 0.80
                  ? "3,200 M"
                  : "850 HPA"}
          </span>
        </div>
        <div className="atm-hud-bar">
          <div
            className="atm-hud-bar-fill"
            style={{ height: `${Math.round(scrollProgress * 100)}%` }}
          />
        </div>
        <div className="atm-hud-marker">
          <span className="atm-hud-mono">SENSOR</span>
          <span className="atm-hud-val">RAW 14B</span>
        </div>
      </div>

      {/* Fixed Full-Screen Viewport for Rhythmic Storytelling Overlays */}
      <div className="atm-overlay-viewport">
        {/* ════════════════════════════════════════════════════════════════
            ACT 01 — EARTH / OBSERVABILITY: WIDE ARCHITECTURAL HERO & HUD
            Theme: Deep Cosmic Observability (#010307 + Electric Cyan #38bdf8)
            Layout: Monumental Wide Editorial Header + Architectural Telemetry HUD Strip
        ════════════════════════════════════════════════════════════════ */}
        <section
          className="atm-act atm-act--hero"
          style={{
            opacity: act1Opacity,
            pointerEvents: act1Opacity > 0.1 ? "auto" : "none",
          }}
          aria-label="Earth Observability and Convective Early Warning"
        >
          <div
            className="atm-hero-container"
            style={{
              transform: `translateY(${act1SlideY}px)`,
              transition: "transform 0.1s linear",
            }}
          >
            {/* Top Atmospheric Badge */}
            <div className="atm-hero-eyebrow">
              <span className="atm-radar-ping-dot" />
              <span className="atm-eyebrow-text">
                AUTONOMOUS MULTI-SENSOR CONVECTIVE NOWCAST // 28 DWR RADAR STATIONS
              </span>
              <span className="atm-eyebrow-status">[ LIVE STREAM ]</span>
            </div>

            {/* Monumental 2-Line Architectural Heading */}
            <h1 className="atm-monumental-heading">
              PREDICTING VIOLENT CONVECTION <br />
              <span className="atm-heading-highlight">BEFORE RADAR SEES IT.</span>
            </h1>

            {/* Expansive Subtitle */}
            <p className="atm-hero-description">
              Sub-kilometer atmospheric intelligence fusing INSAT-3DR geostationary thermal infrared,
              ground Doppler radar reflectivity, and real-time Blitzortung VLF lightning telemetry into a 0–6 hour
              probabilistic forecast across India.
            </p>

            {/* Hero Interactive Button Cluster */}
            <div className="atm-hero-actions">
              <button
                className="atm-btn-grand-launch"
                onClick={onNavigateToDashboard}
                aria-label="Launch the Megh operations console"
              >
                <span className="atm-btn-sparkle">
                  <Sparkles size={16} />
                </span>
                <span className="atm-btn-text">LAUNCH OPERATIONS CONSOLE</span>
                <span className="atm-btn-arrow-disc">
                  <ArrowRight size={16} />
                </span>
              </button>

              <button
                className="atm-btn-explore-pipeline"
                onClick={() => handleScrollToTier(1)}
                aria-label="Descend to the data pipeline"
              >
                <Activity size={14} className="atm-btn-icon-subtle" />
                <span>EXPLORE DATA PIPELINE // 02</span>
                <ChevronDown size={14} />
              </button>
            </div>

            {/* Architectural Horizontal Telemetry HUD Strip */}
            <div className="atm-hero-hud-strip">
              <div className="atm-hud-cell">
                <div className="atm-cell-header">
                  <span className="atm-cell-dot" />
                  <span className="atm-cell-title">DOPPLER COMPOSITE</span>
                </div>
                <strong className="atm-cell-value">28 Active Stations</strong>
                <span className="atm-cell-meta">RainViewer 500m dBZ Ingest</span>
              </div>

              <div className="atm-hud-divider" />

              <div className="atm-hud-cell">
                <div className="atm-cell-header">
                  <span className="atm-cell-dot" />
                  <span className="atm-cell-title">SATELLITE THERMAL</span>
                </div>
                <strong className="atm-cell-value">INSAT-3DR TIR-1</strong>
                <span className="atm-cell-meta">10.8 µm Brightness Temp</span>
              </div>

              <div className="atm-hud-divider" />

              <div className="atm-hud-cell">
                <div className="atm-cell-header">
                  <span className="atm-cell-dot" />
                  <span className="atm-cell-title">VLF LIGHTNING</span>
                </div>
                <strong className="atm-cell-value">Blitzortung MQTT</strong>
                <span className="atm-cell-meta">Sub-Millisecond Discharges</span>
              </div>

              <div className="atm-hud-divider" />

              <div className="atm-hud-cell">
                <div className="atm-cell-header">
                  <span className="atm-cell-dot atm-cell-dot--green" />
                  <span className="atm-cell-title">INGEST LATENCY</span>
                </div>
                <strong className="atm-cell-value">&lt; 42 Seconds</strong>
                <span className="atm-cell-meta">Real-Time Dispatch Grid</span>
              </div>
            </div>
          </div>

          {/* Bottom Scroll Cue */}
          <div
            className="atm-hero-scroll-cue"
            onClick={() => handleScrollToTier(1)}
            role="button"
            tabIndex={0}
          >
            <span className="atm-scroll-cue-text">SCROLL TO DIVE INTO THE STRATOSPHERE</span>
            <div className="atm-scroll-cue-line">
              <div className="atm-scroll-cue-pip" />
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            ACT 02 — CLOUD OCEAN: KINETIC STAGGERED FLIGHT PIPELINE
            Theme: Stratospheric High-Altitude Ice (#040914 + Luminous Steel Blue)
            Layout: Wide Horizontal Kinetic Pipeline Conduits + Telemetry Stream Log
        ════════════════════════════════════════════════════════════════ */}
        <section
          className="atm-act atm-act--pipeline"
          style={{
            opacity: act2Opacity,
            pointerEvents: act2Opacity > 0.1 ? "auto" : "none",
          }}
          aria-label="Stratospheric Radar Pipeline"
        >
          <div
            className="atm-pipeline-container"
            style={{
              transform: `translateY(${act2SlideY}px)`,
              transition: "transform 0.1s linear",
            }}
          >
            {/* Header Block */}
            <div className="atm-pipeline-header">
              <div className="atm-pill-tag">
                <Sliders size={13} className="atm-accent-icon" />
                <span>LEVEL 02 // 11,400M TROPOPAUSE // 4-STAGE PIPELINE</span>
              </div>

              <h2 className="atm-pipeline-title">
                From raw radar beams to emergency dispatch <br />
                <span className="atm-text-gradient">in forty-two seconds.</span>
              </h2>

              <p className="atm-pipeline-sub">
                Every 15 minutes, raw multi-band telemetry is calibrated, advected with neural optical flow,
                and compiled into sub-kilometer hazard polygons.
              </p>
            </div>

            {/* 4 Interactive Staggered Pipeline Cards with Connecting Flow Conduits */}
            <div className="atm-pipeline-flow-deck">
              <div className="atm-flow-card">
                <div className="atm-card-step-tag">
                  <span className="atm-step-index">01</span>
                  <Database size={15} className="atm-step-icon" />
                </div>
                <h3 className="atm-card-title">Multi-Source Ingest</h3>
                <p className="atm-card-desc">
                  Autonomous scraping of RainViewer Doppler arrays, Sentinel-3 thermal rasters, and ISRO MOSDAC.
                </p>
                <div className="atm-card-metric-badge">
                  <span>FREQUENCY</span>
                  <strong>15 MIN CYCLES</strong>
                </div>
              </div>

              <div className="atm-flow-connector">
                <span className="atm-connector-pulse" />
              </div>

              <div className="atm-flow-card">
                <div className="atm-card-step-tag">
                  <span className="atm-step-index">02</span>
                  <Activity size={15} className="atm-step-icon" />
                </div>
                <h3 className="atm-card-title">Physics Calibration</h3>
                <p className="atm-card-desc">
                  Marshall-Palmer empirical Z-R relation, clutter suppression, and bilinear reprojection to 1–3 km grid.
                </p>
                <div className="atm-card-metric-badge">
                  <span>RESOLUTION</span>
                  <strong>1–3 KM MULTI-TENSOR</strong>
                </div>
              </div>

              <div className="atm-flow-connector">
                <span className="atm-connector-pulse" />
              </div>

              <div className="atm-flow-card">
                <div className="atm-card-step-tag">
                  <span className="atm-step-index">03</span>
                  <Cpu size={15} className="atm-step-icon" />
                </div>
                <h3 className="atm-card-title">Neural Advection</h3>
                <p className="atm-card-desc">
                  Ensemble coupling pySTEPS semi-Lagrangian optical flow with DeepMind DGMR generative radar diffusion.
                </p>
                <div className="atm-card-metric-badge">
                  <span>HORIZON</span>
                  <strong>0–6 HR TIME-STEP</strong>
                </div>
              </div>

              <div className="atm-flow-connector">
                <span className="atm-connector-pulse" />
              </div>

              <div className="atm-flow-card">
                <div className="atm-card-step-tag">
                  <span className="atm-step-index">04</span>
                  <Send size={15} className="atm-step-icon" />
                </div>
                <h3 className="atm-card-title">Polygon Dispatch</h3>
                <p className="atm-card-desc">
                  Vector GeoJSON hazard boundary extraction with automated cell arrival countdown timers.
                </p>
                <div className="atm-card-metric-badge">
                  <span>OUTPUT</span>
                  <strong>SUB-KM GEOJSON</strong>
                </div>
              </div>
            </div>

            {/* Dynamic Stream Telemetry Log Bar */}
            <div className="atm-stream-log-bar">
              <span className="atm-stream-label">&gt; TELEMETRY_STREAM:</span>
              <span className="atm-stream-content">
                IMD_RADAR_OK · BLITZORTUNG_VLF 128 MSG/S · MOSDAC_INSAT3DR SYNCED · ECMWF_0.25 OK
              </span>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            ACT 03 — SEVERE STORM: TACTICAL HAZARD BENTO ARCHITECTURE
            Theme: Warning-Grade Extreme Hazard (Amber #f59e0b & Crimson #ef4444)
            Layout: Asymmetrical Gapless Bento Matrix with Live dBZ Reflectivity Meters
        ════════════════════════════════════════════════════════════════ */}
        <section
          className="atm-act atm-act--hazards"
          style={{
            opacity: act3Opacity,
            pointerEvents: act3Opacity > 0.1 ? "auto" : "none",
          }}
          aria-label="Severe Convective Hazard Matrix"
        >
          <div
            className="atm-hazard-bento-container"
            style={{
              transform: `translateY(${act3SlideY}px)`,
              transition: "transform 0.1s linear",
            }}
          >
            {/* Top Hazard Alert Banner */}
            <div className="atm-hazard-banner">
              <div className="atm-pill-tag atm-pill-tag--alert">
                <AlertTriangle size={13} className="atm-alert-icon" />
                <span>LEVEL 03 // 3,200M MESOSCALE COMPLEX // HAZARD RADAR MATRIX</span>
              </div>
              <div className="atm-hazard-warning-strip">
                <span className="atm-warning-beacon" />
                <span>ACTIVE CONVECTIVE WARNINGS: 3 DETECTED IN SUBCONTINENT</span>
              </div>
            </div>

            {/* Asymmetrical Bento Grid */}
            <div className="atm-hazard-bento-grid">
              {/* Bento Card 1: Flagship Supercell Couplet (Large) */}
              <div className="atm-bento-card atm-bento-card--flagship">
                <div className="atm-card-header">
                  <div className="atm-hazard-tag-wrap">
                    <span className="atm-hazard-chip atm-hazard-chip--red">SEVERE COUPLER</span>
                    <span className="atm-hazard-id">ID: MC-8492</span>
                  </div>
                  <Wind size={20} className="atm-hazard-icon--red" />
                </div>

                <h3 className="atm-bento-title">Mesocyclone Velocity Couplet</h3>
                <p className="atm-bento-desc">
                  Doppler radial velocity couplets with local velocity delta &Delta;v &ge; 25 m/s identifying violent
                  rotating updrafts before surface tornado or downburst touchdown.
                </p>

                <div className="atm-bento-metrics-row">
                  <div className="atm-mini-metric">
                    <span className="atm-metric-lbl">ROTATION VELOCITY</span>
                    <strong className="atm-metric-val atm-metric-val--red">&Delta;v &ge; 28.4 m/s</strong>
                  </div>
                  <div className="atm-mini-metric">
                    <span className="atm-metric-lbl">UPDRAFT SPEED</span>
                    <strong className="atm-metric-val atm-metric-val--amber">+46.2 m/s</strong>
                  </div>
                  <div className="atm-mini-metric">
                    <span className="atm-metric-lbl">CONFIDENCE</span>
                    <strong className="atm-metric-val">99.4%</strong>
                  </div>
                </div>

                <div className="atm-bento-meter-wrap">
                  <div className="atm-meter-labels">
                    <span>DOPPLER SHEAR SEVERITY</span>
                    <span className="atm-meter-val">88% (EXTREME)</span>
                  </div>
                  <div className="atm-bento-meter-track">
                    <div className="atm-bento-meter-fill atm-bento-meter-fill--red" style={{ width: "88%" }} />
                  </div>
                </div>
              </div>

              {/* Bento Card 2: Hail Core Swaths */}
              <div className="atm-bento-card">
                <div className="atm-card-header">
                  <span className="atm-hazard-chip atm-hazard-chip--amber">HAIL SWATH</span>
                  <Flame size={18} className="atm-hazard-icon--amber" />
                </div>
                <h3 className="atm-bento-title">Hail Core Swaths (&ge; 55 dBZ)</h3>
                <p className="atm-bento-desc">
                  Collocated rule: radar reflectivity &ge; 55 dBZ combined with cloud-top temperature &le; 210K (TIR-1)
                  and high-density VLF lightning bursts.
                </p>
                <div className="atm-bento-meter-wrap">
                  <div className="atm-meter-labels">
                    <span>REFLECTIVITY INTENSITY</span>
                    <span className="atm-meter-val">62 dBZ</span>
                  </div>
                  <div className="atm-bento-meter-track">
                    <div className="atm-bento-meter-fill atm-bento-meter-fill--amber" style={{ width: "82%" }} />
                  </div>
                </div>
              </div>

              {/* Bento Card 3: Cloudburst Flash Flood */}
              <div className="atm-bento-card">
                <div className="atm-card-header">
                  <span className="atm-hazard-chip atm-hazard-chip--blue">CLOUDBURST</span>
                  <CloudRain size={18} className="atm-hazard-icon--blue" />
                </div>
                <h3 className="atm-bento-title">Extreme Rain Inundation</h3>
                <p className="atm-bento-desc">
                  pySTEPS advection extrapolation alerting extreme rainfall rates (&ge; 15 mm/hr IMD boundary) with
                  flash-flood runoff vectors.
                </p>
                <div className="atm-bento-meter-wrap">
                  <div className="atm-meter-labels">
                    <span>PRECIPITATION RATE</span>
                    <span className="atm-meter-val">85 mm/hr</span>
                  </div>
                  <div className="atm-bento-meter-track">
                    <div className="atm-bento-meter-fill atm-bento-meter-fill--blue" style={{ width: "92%" }} />
                  </div>
                </div>
              </div>

              {/* Bento Card 4: AI Model Benchmarks */}
              <div className="atm-bento-card atm-bento-card--models">
                <div className="atm-card-header">
                  <span className="atm-hazard-chip">AI NOWCAST ENGINES</span>
                  <Cpu size={18} className="atm-accent-icon" />
                </div>
                <h3 className="atm-bento-title">Dual-Engine Inference</h3>
                <div className="atm-engine-compare-list">
                  <div className="atm-engine-item">
                    <span className="atm-engine-name">pySTEPS Semi-Lagrangian:</span>
                    <span className="atm-engine-score">CSI = 0.62 @ 30 min</span>
                  </div>
                  <div className="atm-engine-item">
                    <span className="atm-engine-name">DeepMind DGMR GAN:</span>
                    <span className="atm-engine-score">CSI = 0.74 @ 60 min</span>
                  </div>
                </div>
                <div className="atm-models-foot">
                  <span>LOSS FORMULATION: FOCAL FRECHET + CONSERVATIVE MASS FLUX</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            ACT 04 — CYCLONE EPICENTER: AEROSPACE MISSION COMMAND CONSOLE
            Theme: Command Deck Titanium & Military Green (#020610 + Green/Cyan #10b981)
            Layout: Concentric Doppler Compass Overlay + Grand Command Mission Console
        ════════════════════════════════════════════════════════════════ */}
        <section
          className="atm-act atm-act--terminal"
          style={{
            opacity: act4Opacity,
            pointerEvents: act4Opacity > 0.1 ? "auto" : "none",
          }}
          aria-label="Operations Terminal Console"
        >
          <div
            className="atm-terminal-deck-container"
            style={{
              transform: `translateY(${act4SlideY}px)`,
              transition: "transform 0.1s linear",
            }}
          >
            {/* Mission Status Bar */}
            <div className="atm-pill-tag">
              <Radio size={13} className="atm-pulse-icon" />
              <span>LEVEL 04 // 850 hPa CYCLONE CORE // TERMINAL LAUNCH</span>
            </div>

            {/* Grand Command Chassis */}
            <div className="atm-terminal-master-chassis">
              {/* Concentric Doppler Compass Graphics centered above title */}
              <div className="atm-doppler-compass" aria-hidden="true">
                <div className="atm-compass-ring atm-compass-ring--outer" />
                <div className="atm-compass-ring atm-compass-ring--inner" />
                <div className="atm-compass-crosshair atm-compass-crosshair--h" />
                <div className="atm-compass-crosshair atm-compass-crosshair--v" />
                <span className="atm-azimuth atm-azimuth--n">000° N</span>
                <span className="atm-azimuth atm-azimuth--e">090° E</span>
                <span className="atm-azimuth atm-azimuth--s">180° S</span>
                <span className="atm-azimuth atm-azimuth--w">270° W</span>
              </div>

              <div className="atm-console-status-row">
                <div className="atm-console-badge">
                  <span className="atm-console-dot" />
                  <span>ALL RADAR MATRICES SYNCHRONIZED</span>
                </div>
                <div className="atm-console-version">MEGH OPS v2.4 // PRODUCTION</div>
              </div>

              <h2 className="atm-console-heading">
                Launch the Megh Operations Terminal
              </h2>

              <p className="atm-console-desc">
                Full-bleed GPU-accelerated MapLibre GL radar viewer, 23 ISRO/MOSDAC GIS layers,
                0–6 hour time-scrubbing sliders, and automated emergency polygon dispatch.
              </p>

              {/* 3 Specifications Pills */}
              <div className="atm-console-specs-deck">
                <div className="atm-spec-cell">
                  <Clock size={16} className="atm-accent-icon" />
                  <span className="atm-spec-title">TIME SCRUBBING</span>
                  <strong className="atm-spec-value">0–6 Hours</strong>
                </div>
                <div className="atm-spec-divider" />
                <div className="atm-spec-cell">
                  <Layers size={16} className="atm-accent-icon" />
                  <span className="atm-spec-title">GIS CHANNELS</span>
                  <strong className="atm-spec-value">23 Layers</strong>
                </div>
                <div className="atm-spec-divider" />
                <div className="atm-spec-cell">
                  <Radar size={16} className="atm-accent-icon" />
                  <span className="atm-spec-title">RADAR LATENCY</span>
                  <strong className="atm-spec-value">&lt; 42 Seconds</strong>
                </div>
              </div>

              {/* Primary Massive High-Impact Launch Button */}
              <button
                className="atm-btn-launch-terminal-massive"
                onClick={onNavigateToDashboard}
                aria-label="Enter the weather operations dashboard"
              >
                <span className="atm-launch-label">ENTER OPERATIONS TERMINAL</span>
                <span className="atm-launch-arrow-circle">
                  <ArrowRight size={18} />
                </span>
              </button>

              {/* Deployment Domains Badges */}
              <div className="atm-deployment-domains">
                <div className="atm-domain-tag">
                  <Shield size={14} className="atm-domain-accent" />
                  <span>National Disaster Response (NDRF)</span>
                </div>
                <div className="atm-domain-tag">
                  <Compass size={14} className="atm-domain-accent" />
                  <span>Civil Aviation & Airport ATC</span>
                </div>
                <div className="atm-domain-tag">
                  <Layers size={14} className="atm-domain-accent" />
                  <span>Agricultural Hail Defense</span>
                </div>
              </div>
            </div>

            {/* Clean Authoritative Footer */}
            <footer className="atm-command-footer">
              <span className="atm-foot-bold">MEGH v2.4</span>
              <span className="atm-foot-dot">&bull;</span>
              <span>Autonomous Convective Weather Intelligence System</span>
              <span className="atm-foot-dot">&bull;</span>
              <span className="atm-foot-highlight">pySTEPS · DeepMind DGMR · IMD Radar · ISRO Sentinel-3</span>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ATMOSPHERIC DESIGN SYSTEM — STYLESHEET
// BOLD & CREATIVE AESTHETICS:
// - Monumental Outfit & Plus Jakarta Sans typography
// - Radically different layouts per Act (Wide Hero HUD -> Kinetic Flight Pipeline -> Hazard Bento -> Mission Deck)
// - Varied theme color punctuation (Cosmic Cyan -> Stratospheric Steel -> Warning Amber/Crimson -> Command Deck)
// ═════════════════════════════════════════════════════════════════════════════
const BOLD_CREATIVE_LANDING_STYLES = `
/* ── Reset & Core Tokens ─────────────────────────────────────────────────── */
.atm-landing-page {
  position: relative;
  width: 100%;
  height: 560vh;
  background-color: #010307;
  color: #f1f5f9;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow-x: hidden;
  user-select: none;
}

/* ── Photographic Viewport with Raw Hazard Filter ────────────────────────── */
.atm-viewport-root {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
  background-color: #010307;
}

.atm-deep-scrim {
  position: absolute;
  inset: 0;
  z-index: 6;
  background: radial-gradient(ellipse at 50% 50%, rgba(1, 3, 7, 0.40) 0%, rgba(0, 1, 4, 0.90) 100%);
  pointer-events: none;
}

.atm-stage-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform, opacity;
  transition: opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

.atm-hazard-image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.atm-stage-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  user-select: none;
  pointer-events: none;
  animation: atm-fluid-wave 16s ease-in-out infinite alternate;
}

@keyframes atm-fluid-wave {
  0% { transform: scale(1.0) translateY(0px); }
  50% { transform: scale(1.02) translateY(-6px); }
  100% { transform: scale(1.01) translateY(4px); }
}

/* Raw Hazard Sensor Contrast Grading */
.atm-stage-img--earth {
  object-position: center center;
  filter: contrast(1.36) brightness(0.70) saturate(1.18);
}

.atm-stage-img--clouds {
  object-position: center center;
  filter: contrast(1.38) brightness(0.50) saturate(0.92);
}

.atm-stage-img--storm {
  object-position: center 60%;
  filter: contrast(1.44) brightness(0.62) saturate(1.32) hue-rotate(-8deg);
}

.atm-stage-img--cyclone {
  width: 135vw;
  height: 135vh;
  max-width: none;
  max-height: none;
  object-fit: cover;
  object-position: center center;
  filter: contrast(1.40) brightness(0.66) saturate(1.25);
}

/* Raw Optical Prism Chromatic Aberration Fringe */
.atm-hazard-chromatic-fringe {
  position: absolute;
  inset: 0;
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: 0.16;
  background: linear-gradient(
    90deg,
    rgba(239, 68, 68, 0.1) 0%,
    transparent 35%,
    transparent 65%,
    rgba(56, 189, 248, 0.1) 100%
  );
}

/* Severe Updraft Amber-Crimson Hazard Spectrum Glow (Act 3) */
.atm-storm-hazard-spectral-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at 50% 60%,
    rgba(239, 68, 68, 0.18) 0%,
    rgba(245, 158, 11, 0.1) 40%,
    transparent 70%
  );
  pointer-events: none;
  mix-blend-mode: color-dodge;
  animation: atm-hazard-pulse 3.8s ease-in-out infinite;
}

@keyframes atm-hazard-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.95; }
}

/* CRT / Radar Horizontal Scanline Raster */
.atm-hazard-scanline-raster {
  position: absolute;
  inset: 0;
  z-index: 7;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.28) 0px,
    rgba(0, 0, 0, 0.28) 1px,
    transparent 1px,
    transparent 3px
  );
  opacity: 0.85;
}

/* Raw Analog Sensor Noise / Dither Overlay */
.atm-hazard-sensor-grain {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  filter: url(#raw-sensor-noise);
  opacity: 0.24;
  mix-blend-mode: overlay;
}

/* Tactical Radar Scope Reticles */
.atm-hazard-telemetry-hud {
  position: absolute;
  inset: 20px;
  z-index: 9;
  pointer-events: none;
  font-family: 'JetBrains Mono', monospace;
  color: rgba(56, 189, 248, 0.26);
}

.atm-reticle-corner {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 8px;
  letter-spacing: 0.14em;
  font-weight: 700;
}

.atm-reticle--tl { top: 64px; left: 16px; }
.atm-reticle--tr { top: 64px; right: 16px; flex-direction: row-reverse; }
.atm-reticle--bl { bottom: 16px; left: 16px; }
.atm-reticle--br { bottom: 16px; right: 16px; flex-direction: row-reverse; }

.atm-reticle-tick {
  font-size: 14px;
  color: rgba(56, 189, 248, 0.45);
  line-height: 1;
}

.atm-reticle-mono {
  text-shadow: 0 0 8px rgba(56, 189, 248, 0.4);
}

.atm-crosshair {
  position: absolute;
  font-size: 11px;
  color: rgba(56, 189, 248, 0.18);
}

.atm-crosshair--1 { top: 22%; left: 18%; }
.atm-crosshair--2 { top: 22%; right: 18%; }
.atm-crosshair--3 { bottom: 22%; left: 18%; }
.atm-crosshair--4 { bottom: 22%; right: 18%; }

.atm-cyclone-rotator {
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
}

.atm-scene-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.atm-scene-vignette--earth {
  background: radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.04) 0%, rgba(1, 3, 7, 0.78) 90%);
}

.atm-scene-vignette--clouds {
  background: radial-gradient(circle at 50% 50%, rgba(2, 6, 14, 0.5) 0%, rgba(1, 3, 7, 0.92) 100%);
}

.atm-scene-vignette--storm {
  background: radial-gradient(circle at 50% 50%, transparent 35%, rgba(1, 3, 7, 0.90) 100%);
}

.atm-scene-vignette--cyclone {
  background: radial-gradient(circle at 50% 50%, transparent 40%, rgba(1, 3, 7, 0.88) 100%);
}

.atm-cyclone-eye-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, rgba(30, 64, 175, 0.15) 50%, transparent 70%);
  filter: blur(18px);
  pointer-events: none;
  animation: atm-eye-pulse 3s infinite ease-in-out;
}

@keyframes atm-eye-pulse {
  0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.9); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
}

.atm-vapor-veil {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  pointer-events: none;
  transition: background-color 0.3s ease, opacity 0.12s linear;
}

/* ── Fixed Pinned Overlay Viewport ───────────────────────────────────────── */
.atm-overlay-viewport {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 10;
  overflow: hidden;
}

/* ── Left HUD Altitude Gauge ────────────────────────────────────────────── */
.atm-hud-strip {
  position: fixed;
  left: 28px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  z-index: 40;
  pointer-events: none;
}

.atm-hud-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.atm-hud-mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.16em;
  color: #475569;
}

.atm-hud-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #cbd5e1;
}

.atm-hud-bar {
  width: 2px;
  height: 120px;
  background: #1a273b;
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.atm-hud-bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  background: #38bdf8;
  box-shadow: 0 0 10px #38bdf8;
  transition: height 0.1s linear;
}

/* ── Common Typography & Shared Tags ────────────────────────────────────── */
.atm-act {
  position: absolute;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 56px;
  pointer-events: none;
}

.atm-pill-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 9999px;
  background: #030713;
  border: 1px solid #1e293b;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #38bdf8;
  margin-bottom: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7);
}

.atm-pill-tag--alert {
  background: #180909;
  border-color: #7f1d1d;
  color: #f87171;
}

.atm-accent-icon {
  color: #38bdf8;
}

.atm-text-gradient {
  background: linear-gradient(135deg, #ffffff 15%, #7dd3fc 65%, #38bdf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACT 01: MONUMENTAL WIDE ARCHITECTURAL HERO & HUD
   ═══════════════════════════════════════════════════════════════════════════ */
.atm-act--hero {
  align-items: center;
  justify-content: center;
}

.atm-hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: min(1280px, 100%);
  will-change: transform;
}

.atm-hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 18px;
  border-radius: 9999px;
  background: #030713;
  border: 1px solid #1e293b;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #94a3b8;
  margin-bottom: 22px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
}

.atm-radar-ping-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 10px #38bdf8;
  animation: atm-pulse 1.6s infinite ease-in-out;
}

.atm-eyebrow-text {
  color: #cbd5e1;
}

.atm-eyebrow-status {
  color: #38bdf8;
}

/* Monumental Outfit Heading (2 Lines Max, Architectural Impact) */
.atm-monumental-heading {
  font-family: 'Outfit', sans-serif;
  font-size: clamp(38px, 5.2vw, 68px);
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: #ffffff;
  margin: 0 0 20px 0;
  text-transform: uppercase;
  text-shadow: 0 4px 32px rgba(0, 0, 0, 0.98);
  max-width: 1100px;
}

.atm-heading-highlight {
  background: linear-gradient(135deg, #ffffff 10%, #7dd3fc 60%, #38bdf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.atm-hero-description {
  font-size: clamp(15px, 1.25vw, 17px);
  line-height: 1.65;
  color: #94a3b8;
  max-width: 780px;
  margin: 0 0 32px 0;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.9);
}

/* Hero Button Cluster */
.atm-hero-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 36px;
}

.atm-btn-grand-launch {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 8px 0 24px;
  background: #f8fafc;
  color: #020617;
  font-family: 'Outfit', sans-serif;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  border: none;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.85);
  outline: none;
}

.atm-btn-sparkle {
  color: #0284c7;
}

.atm-btn-arrow-disc {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(2, 6, 23, 0.12);
  color: #020617;
  transition: transform 0.2s ease;
}

.atm-btn-grand-launch:hover {
  background: #38bdf8;
  box-shadow: 0 20px 48px rgba(56, 189, 248, 0.55);
  transform: translateY(-2px);
}

.atm-btn-grand-launch:hover .atm-btn-arrow-disc {
  transform: translateX(3px);
}

.atm-btn-explore-pipeline {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 24px;
  background: #030713;
  color: #cbd5e1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  border: 1px solid #1e293b;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.atm-btn-explore-pipeline:hover {
  background: #081220;
  border-color: #38bdf8;
  color: #ffffff;
}

.atm-btn-icon-subtle {
  color: #38bdf8;
}

/* Architectural Horizontal Telemetry HUD Strip */
.atm-hero-hud-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1080px;
  background: #030713;
  border: 1px solid #1e293b;
  border-radius: 16px;
  padding: 16px 24px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.95), 0 0 20px rgba(56, 189, 248, 0.06);
}

.atm-hud-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  flex: 1;
  padding: 0 16px;
}

.atm-cell-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.atm-cell-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
}

.atm-cell-dot--green {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.atm-cell-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #64748b;
}

.atm-cell-value {
  font-family: 'Outfit', sans-serif;
  font-size: 15px;
  font-weight: 800;
  color: #f8fafc;
}

.atm-cell-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: #38bdf8;
}

.atm-hud-divider {
  width: 1px;
  height: 36px;
  background: #162235;
}

/* Bottom Scroll Cue */
.atm-hero-scroll-cue {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  pointer-events: auto;
}

.atm-scroll-cue-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #475569;
  transition: color 0.2s ease;
}

.atm-hero-scroll-cue:hover .atm-scroll-cue-text {
  color: #38bdf8;
}

.atm-scroll-cue-line {
  width: 1px;
  height: 24px;
  background: #1e293b;
  position: relative;
  overflow: hidden;
}

.atm-scroll-cue-pip {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 8px;
  background: #38bdf8;
  box-shadow: 0 0 6px #38bdf8;
  animation: atm-pip-drop 1.8s infinite cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes atm-pip-drop {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(280%); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACT 02: KINETIC STAGGERED FLIGHT PIPELINE
   ═══════════════════════════════════════════════════════════════════════════ */
.atm-act--pipeline {
  align-items: center;
  justify-content: center;
}

.atm-pipeline-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(1240px, 100%);
  will-change: transform;
}

.atm-pipeline-header {
  text-align: center;
  margin-bottom: 24px;
}

.atm-pipeline-title {
  font-family: 'Outfit', sans-serif;
  font-size: clamp(30px, 3.8vw, 48px);
  font-weight: 900;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #ffffff;
  margin: 0 0 12px 0;
}

.atm-pipeline-sub {
  font-size: 15px;
  line-height: 1.6;
  color: #94a3b8;
  max-width: 680px;
  margin: 0 auto;
}

.atm-pipeline-flow-deck {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
  margin-bottom: 24px;
}

.atm-flow-card {
  flex: 1;
  background: #030713;
  border: 1px solid #1e293b;
  border-radius: 16px;
  padding: 22px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.95);
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}

.atm-flow-card:hover {
  transform: translateY(-4px);
  border-color: #38bdf8;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.95), 0 0 20px rgba(56, 189, 248, 0.12);
}

.atm-card-step-tag {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.atm-step-index {
  font-family: 'Outfit', sans-serif;
  font-size: 20px;
  font-weight: 900;
  color: #38bdf8;
}

.atm-step-icon {
  color: #64748b;
}

.atm-card-title {
  font-family: 'Outfit', sans-serif;
  font-size: 16px;
  font-weight: 800;
  color: #ffffff;
  margin: 0;
}

.atm-card-desc {
  font-size: 12px;
  line-height: 1.55;
  color: #94a3b8;
  margin: 0;
  min-height: 54px;
}

.atm-card-metric-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  background: #060e1d;
  border: 1px solid #132238;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  color: #475569;
}

.atm-card-metric-badge strong {
  color: #7dd3fc;
}

.atm-flow-connector {
  width: 24px;
  height: 2px;
  background: #1e293b;
  position: relative;
  flex-shrink: 0;
}

.atm-connector-pulse {
  position: absolute;
  top: -2px;
  left: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
  animation: atm-flow-slide 2s infinite linear;
}

@keyframes atm-flow-slide {
  0% { left: 0%; opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { left: 100%; opacity: 0; }
}

.atm-stream-log-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  border-radius: 9999px;
  background: #030713;
  border: 1px solid #1e293b;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: #94a3b8;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.8);
}

.atm-stream-label {
  font-weight: 700;
  color: #38bdf8;
}

.atm-stream-content {
  letter-spacing: 0.08em;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACT 03: TACTICAL HAZARD BENTO ARCHITECTURE (AMBER & CRIMSON ALERTS)
   ═══════════════════════════════════════════════════════════════════════════ */
.atm-act--hazards {
  align-items: center;
  justify-content: center;
}

.atm-hazard-bento-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(1200px, 100%);
  will-change: transform;
}

.atm-hazard-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 18px;
}

.atm-alert-icon {
  color: #ef4444;
}

.atm-hazard-warning-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 9999px;
  background: #180909;
  border: 1px solid #7f1d1d;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #f87171;
}

.atm-warning-beacon {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 10px #ef4444;
  animation: atm-pulse 1.2s infinite ease-in-out;
}

/* Gapless Bento Grid */
.atm-hazard-bento-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 16px;
  width: 100%;
}

.atm-bento-card {
  background: #030713;
  border: 1px solid #1e293b;
  border-radius: 16px;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.95);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.atm-bento-card:hover {
  transform: translateY(-2px);
  border-color: #38bdf8;
}

.atm-bento-card--flagship {
  grid-row: span 2;
  border-color: #7f1d1d;
  background: linear-gradient(180deg, #090305 0%, #030713 100%);
}

.atm-bento-card--flagship:hover {
  border-color: #ef4444;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.95), 0 0 24px rgba(239, 68, 68, 0.15);
}

.atm-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.atm-hazard-tag-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.atm-hazard-chip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 3px 8px;
  border-radius: 4px;
  background: #081220;
  border: 1px solid #1e293b;
  color: #94a3b8;
}

.atm-hazard-chip--red {
  background: #230808;
  border-color: #7f1d1d;
  color: #f87171;
}

.atm-hazard-chip--amber {
  background: #1c1103;
  border-color: #78350f;
  color: #fbbf24;
}

.atm-hazard-chip--blue {
  background: #051429;
  border-color: #1e3a8a;
  color: #60a5fa;
}

.atm-hazard-id {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: #64748b;
}

.atm-hazard-icon--red { color: #ef4444; }
.atm-hazard-icon--amber { color: #f59e0b; }
.atm-hazard-icon--blue { color: #3b82f6; }

.atm-bento-title {
  font-family: 'Outfit', sans-serif;
  font-size: 18px;
  font-weight: 800;
  color: #ffffff;
  margin: 0;
}

.atm-bento-desc {
  font-size: 13px;
  line-height: 1.55;
  color: #94a3b8;
  margin: 0;
}

.atm-bento-metrics-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  background: #050b18;
  border: 1px solid #132238;
}

.atm-mini-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.atm-metric-lbl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  color: #475569;
}

.atm-metric-val {
  font-family: 'Outfit', sans-serif;
  font-size: 13px;
  font-weight: 800;
  color: #f1f5f9;
}

.atm-metric-val--red { color: #f87171; }
.atm-metric-val--amber { color: #fbbf24; }

.atm-bento-meter-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.atm-meter-labels {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: #64748b;
}

.atm-meter-val {
  font-weight: 700;
  color: #cbd5e1;
}

.atm-bento-meter-track {
  width: 100%;
  height: 5px;
  background: #0c1524;
  border-radius: 3px;
  overflow: hidden;
}

.atm-bento-meter-fill {
  height: 100%;
  border-radius: 3px;
}

.atm-bento-meter-fill--red {
  background: linear-gradient(90deg, #f87171, #ef4444);
  box-shadow: 0 0 8px #ef4444;
}

.atm-bento-meter-fill--amber {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
  box-shadow: 0 0 8px #f59e0b;
}

.atm-bento-meter-fill--blue {
  background: linear-gradient(90deg, #60a5fa, #2563eb);
  box-shadow: 0 0 8px #3b82f6;
}

/* Models Card */
.atm-bento-card--models {
  grid-column: span 2;
}

.atm-engine-compare-list {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 8px;
  background: #050b18;
  border: 1px solid #132238;
}

.atm-engine-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.atm-engine-name {
  color: #94a3b8;
}

.atm-engine-score {
  font-weight: 700;
  color: #38bdf8;
}

.atm-models-foot {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  color: #475569;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACT 04: AEROSPACE MISSION COMMAND DECK & DOPPLER COMPASS
   ═══════════════════════════════════════════════════════════════════════════ */
.atm-act--terminal {
  align-items: center;
  justify-content: center;
}

.atm-terminal-deck-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(980px, 100%);
  will-change: transform;
}

.atm-terminal-master-chassis {
  position: relative;
  width: 100%;
  background: #030713;
  border: 1px solid #1e293b;
  border-radius: 24px;
  padding: 38px 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 32px 64px rgba(0, 0, 0, 0.98), 0 0 32px rgba(56, 189, 248, 0.1);
  margin-bottom: 20px;
}

/* Concentric Doppler Compass Graphics */
.atm-doppler-compass {
  position: absolute;
  top: 24px;
  right: 28px;
  width: 80px;
  height: 80px;
  pointer-events: none;
}

.atm-compass-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.atm-compass-ring--outer {
  border-style: dashed;
  animation: atm-compass-spin 20s linear infinite;
}

.atm-compass-ring--inner {
  inset: 16px;
  border: 1px solid rgba(56, 189, 248, 0.4);
}

@keyframes atm-compass-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.atm-compass-crosshair {
  position: absolute;
  background: rgba(56, 189, 248, 0.2);
}

.atm-compass-crosshair--h {
  top: 50%;
  left: 0;
  width: 100%;
  height: 1px;
}

.atm-compass-crosshair--v {
  left: 50%;
  top: 0;
  height: 100%;
  width: 1px;
}

.atm-azimuth {
  position: absolute;
  font-family: 'JetBrains Mono', monospace;
  font-size: 7px;
  color: rgba(56, 189, 248, 0.4);
}

.atm-azimuth--n { top: -10px; left: 50%; transform: translateX(-50%); }
.atm-azimuth--e { right: -12px; top: 50%; transform: translateY(-50%); }
.atm-azimuth--s { bottom: -10px; left: 50%; transform: translateX(-50%); }
.atm-azimuth--w { left: -14px; top: 50%; transform: translateY(-50%); }

.atm-console-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-bottom: 16px;
  border-bottom: 1px solid #132238;
  margin-bottom: 22px;
}

.atm-console-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #10b981;
}

.atm-console-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 10px #10b981;
  animation: atm-pulse 1.8s infinite ease-in-out;
}

.atm-console-version {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #64748b;
}

.atm-console-heading {
  font-family: 'Outfit', sans-serif;
  font-size: clamp(28px, 3.4vw, 42px);
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #ffffff;
  text-align: center;
  margin: 0 0 12px 0;
  line-height: 1.15;
}

.atm-console-desc {
  font-size: 15px;
  line-height: 1.6;
  color: #94a3b8;
  text-align: center;
  max-width: 640px;
  margin: 0 0 28px 0;
}

/* 3 Specifications Pills */
.atm-console-specs-deck {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #050b18;
  border: 1px solid #132238;
  border-radius: 12px;
  padding: 12px 28px;
  gap: 28px;
  margin-bottom: 30px;
}

.atm-spec-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.atm-spec-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #64748b;
}

.atm-spec-value {
  font-family: 'Outfit', sans-serif;
  font-size: 15px;
  font-weight: 800;
  color: #f1f5f9;
}

.atm-spec-divider {
  width: 1px;
  height: 22px;
  background: #1e293b;
}

/* Primary Massive High-Impact Launch Button */
.atm-btn-launch-terminal-massive {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  height: 56px;
  padding: 0 10px 0 32px;
  background: #f8fafc;
  color: #020617;
  font-family: 'Outfit', sans-serif;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.08em;
  border: none;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.85);
  margin-bottom: 26px;
  outline: none;
}

.atm-launch-arrow-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(2, 6, 23, 0.12);
  color: #020617;
  transition: transform 0.2s ease;
}

.atm-btn-launch-terminal-massive:hover {
  background: #38bdf8;
  box-shadow: 0 20px 48px rgba(56, 189, 248, 0.6);
  transform: translateY(-2px);
}

.atm-btn-launch-terminal-massive:hover .atm-launch-arrow-circle {
  transform: translateX(4px);
}

/* Deployment Domains Badges */
.atm-deployment-domains {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
}

.atm-domain-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 9999px;
  background: #050b18;
  border: 1px solid #132238;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #94a3b8;
}

.atm-domain-accent {
  color: #38bdf8;
}

/* Authoritative Clean Footer */
.atm-command-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #475569;
}

.atm-foot-bold {
  font-weight: 800;
  color: #94a3b8;
}

.atm-foot-dot {
  color: #334155;
}

.atm-foot-highlight {
  color: #38bdf8;
}

/* ── Responsive Adaptations ──────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .atm-hero-hud-strip {
    flex-wrap: wrap;
    gap: 16px;
  }
  .atm-pipeline-flow-deck {
    flex-direction: column;
    gap: 12px;
  }
  .atm-flow-connector {
    display: none;
  }
  .atm-hazard-bento-grid {
    grid-template-columns: 1fr;
  }
  .atm-bento-card--flagship {
    grid-row: auto;
  }
  .atm-bento-card--models {
    grid-column: auto;
  }
  .atm-terminal-master-chassis {
    padding: 32px 24px;
  }
  .atm-doppler-compass {
    display: none;
  }
}

@media (max-width: 768px) {
  .atm-act {
    padding: 0 20px;
  }
  .atm-hud-strip {
    display: none;
  }
  .atm-hero-actions {
    flex-direction: column;
    width: 100%;
  }
  .atm-btn-grand-launch,
  .atm-btn-explore-pipeline {
    width: 100%;
    justify-content: center;
  }
  .atm-console-specs-deck {
    flex-direction: column;
    gap: 12px;
  }
  .atm-spec-divider {
    display: none;
  }
}
`;
