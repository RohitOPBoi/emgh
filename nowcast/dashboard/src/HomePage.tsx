import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, ChevronDown, CloudLightning, CloudRain, Snowflake, Wind } from "lucide-react";
import AtmosphericViewport from "./components/landing/AtmosphericViewport";
import AtmosphericWaveforms from "./components/landing/AtmosphericWaveforms";
import AtmosphericParticles from "./components/landing/AtmosphericParticles";
import LandingNav from "./components/landing/LandingNav";
import { useSystemStatus } from "./hooks/useSystemStatus";
import { BASE_LAYERS, OVERLAY_LAYERS } from "./lib/mosdacLayers";
import { SPEC, SIH } from "./lib/spec";
import "./components/landing/atmosphere.css";
import "./components/landing/landing.css";

gsap.registerPlugin(ScrollTrigger);

interface HomePageProps {
  onNavigateToDashboard: () => void;
}

// Scroll-progress windows where each act becomes "current" (matches the
// background viewport's scene choreography in AtmosphericViewport).
const TIER_BREAKS = [0.26, 0.54, 0.8];
const SCROLL_TARGETS = [0, 0.38, 0.68, 0.98];

// The dive narrative — real altitudes for what each sensor class observes.
const ALTITUDE_STEPS = [
  { value: "35,786 KM", label: "Geostationary orbit" },
  { value: "16 KM", label: "Storm cloud tops" },
  { value: "5 KM", label: "Freezing level · hail" },
  { value: "0 M", label: "Surface · warning" },
];

const PIPELINE = [
  {
    title: "Ingest",
    text: "Radar, lightning, satellite and weather-model feeds are pulled every cycle — each source isolated, so one outage never blinds the rest.",
    tags: "RAINVIEWER · BLITZORTUNG · SENTINEL-3 · ECMWF",
  },
  {
    title: "Fuse",
    text: "Everything is regridded onto a single multi-channel raster: infrared, water vapour, reflectivity and lightning probability, pixel-aligned.",
    tags: "TIR-1 · WV · MWIR · dBZ · LIGHTNING",
  },
  {
    title: "Nowcast",
    text: "pySTEPS optical-flow extrapolation carries every echo up to six hours ahead, with DeepMind's DGMR as an AI generative comparison.",
    tags: `0–${SPEC.horizonHours} H · ${SPEC.stepMin}-MIN STEPS`,
  },
  {
    title: "Warn",
    text: "Physics-based hail, lightning, downburst and cloudburst rules become hazard points, storm arrival times and district SMS alerts.",
    tags: "GEOJSON · STORM ETA · SMS",
  },
];

const stagger = (i: number) => ({ ["--i" as string]: i }) as CSSProperties;

export default function HomePage({ onNavigateToDashboard }: HomePageProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeTier, setActiveTier] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const { status, link } = useSystemStatus();

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
    lenis.on("scroll", () => ScrollTrigger.update());

    const updateTicker = (time: number) => lenis.raf(time * 1000);
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
          setActiveTier(p < TIER_BREAKS[0] ? 0 : p < TIER_BREAKS[1] ? 1 : p < TIER_BREAKS[2] ? 2 : 3);
        },
      });
    }

    return () => {
      st?.kill();
      gsap.ticker.remove(updateTicker);
      lenis.destroy();
    };
  }, []);

  const handleScrollToTier = (tierIndex: number) => {
    if (!containerRef.current || !lenisRef.current) return;
    const totalScrollable = containerRef.current.offsetHeight - window.innerHeight;
    lenisRef.current.scrollTo(SCROLL_TARGETS[tierIndex] * totalScrollable, { duration: 1.4 });
  };

  const p = scrollProgress;
  const drift = (v: number) => (prefersReducedMotion ? 0 : v);

  // Per-act opacity plateaus (100% legibility while an act is "current").
  const act1Opacity = p < 0.2 ? 1 : Math.max(0, 1 - (p - 0.2) / 0.08);
  const act1SlideY = drift(-Math.max(0, (p - 0.16) / 0.12) * 50);
  const act2Opacity = Math.max(0, Math.min((p - 0.22) / 0.08, (0.56 - p) / 0.08));
  const act2SlideY = drift((0.32 - Math.min(0.5, Math.max(0.24, p))) * 120);
  const act3Opacity = Math.max(0, Math.min((p - 0.52) / 0.08, (0.8 - p) / 0.08));
  const act3SlideY = drift((0.64 - Math.min(0.76, Math.max(0.54, p))) * 100);
  const act4Opacity = Math.max(0, Math.min(1, (p - 0.78) / 0.08));
  const act4SlideY = drift(Math.max(0, (0.9 - p) / 0.1) * 45);

  const act = (opacity: number, y: number) => ({
    style: { opacity, pointerEvents: opacity > 0.1 ? "auto" : "none" } as CSSProperties,
    inner: { transform: `translateY(${y}px)` } as CSSProperties,
    cls: opacity > 0.35 ? "is-in" : "",
  });
  const a1 = act(act1Opacity, act1SlideY);
  const a2 = act(act2Opacity, act2SlideY);
  const a3 = act(act3Opacity, act3SlideY);
  const a4 = act(act4Opacity, act4SlideY);

  // ── Live figures (never hard-coded; "—" while offline) ────────────────────
  const live = link === "online" && status !== null;
  const num = (v: number | undefined) => (live && v !== undefined ? String(v) : "—");
  const byType = status?.hazards.by_type ?? {};
  const gisLayers = BASE_LAYERS.length + OVERLAY_LAYERS.length;
  const altitude = ALTITUDE_STEPS[activeTier];
  const pystepsHours = (status?.models.pysteps.horizon_min ?? SPEC.horizonHours * 60) / 60;

  return (
    <div className="atm-landing-page" ref={containerRef}>
      <AtmosphericViewport scrollProgress={scrollProgress} prefersReducedMotion={prefersReducedMotion} />
      <AtmosphericWaveforms scrollProgress={scrollProgress} prefersReducedMotion={prefersReducedMotion} />
      <AtmosphericParticles scrollProgress={scrollProgress} prefersReducedMotion={prefersReducedMotion} />

      <LandingNav
        onNavigateToDashboard={onNavigateToDashboard}
        onScrollToTier={handleScrollToTier}
        activeTier={activeTier}
        link={link}
      />

      {/* Altitude rail — narrates the descent from orbit to the ground */}
      <div className="atm-hud-strip" aria-hidden="true">
        <div className="atm-hud-bar">
          <div className="atm-hud-bar-fill" style={{ height: `${Math.round(scrollProgress * 100)}%` }} />
        </div>
        <div className="ag-mono atm-hud-read">
          <span>{altitude.label}</span>
          <strong>{altitude.value}</strong>
        </div>
      </div>

      <div className="atm-overlay-viewport">
        {/* ═══ 01 · OVERVIEW ═══════════════════════════════════════════ */}
        <section
          className={`atm-act ag-hero ${a1.cls}`}
          style={a1.style}
          aria-label="Agrim — thunderstorm nowcasting for India"
        >
          <div className="ag-wrap" style={a1.inner}>
            <div className="ag-mono ag-eyebrow ag-rise" style={stagger(0)}>
              <span>
                {SIH.edition} · PS {SIH.psId} · <b>MoES / IMD</b>
              </span>
            </div>

            <h1 className="ag-display ag-hero-title ag-rise" style={stagger(1)}>
              See the storm
              <span className="ag-serif">
                before it <em>arrives.</em>
              </span>
            </h1>

            <div className="ag-hero-row ag-rise" style={stagger(2)}>
              <p className="ag-body">
                Agrim fuses radar, satellite, lightning and weather-model data into a six-hour thunderstorm, hail and
                cloudburst nowcast for India — and tells you when the storm will reach you.
              </p>
              <div className="ag-actions">
                <button className="ag-btn ag-btn--solid" onClick={onNavigateToDashboard}>
                  Launch console <ArrowRight size={16} />
                </button>
                <button className="ag-btn ag-btn--ghost" onClick={() => handleScrollToTier(1)}>
                  How it works <ChevronDown size={15} />
                </button>
              </div>
            </div>

            <div className="ag-ribbon ag-rise" style={stagger(3)} aria-label="Live system figures">
              <div className="ag-ribbon-cell">
                <span className="ag-mono ag-ribbon-label">
                  <span className={`ag-dot ${live ? "ag-dot--online" : ""}`} /> Active hazards
                </span>
                <span className="ag-ribbon-value">{num(status?.hazards.total)}</span>
                <span className="ag-mono ag-ribbon-meta">Hail + lightning · all India</span>
              </div>
              <div className="ag-ribbon-cell">
                <span className="ag-mono ag-ribbon-label">Storm cells tracked</span>
                <span className="ag-ribbon-value">{num(status?.storm_cells)}</span>
                <span className="ag-mono ag-ribbon-meta">Optical-flow motion field</span>
              </div>
              <div className="ag-ribbon-cell">
                <span className="ag-mono ag-ribbon-label">Nowcast horizon</span>
                <span className="ag-ribbon-value">
                  0–{pystepsHours}
                  <small>HRS</small>
                </span>
                <span className="ag-mono ag-ribbon-meta">
                  {status?.models.pysteps.step_min ?? SPEC.stepMin}-minute steps
                </span>
              </div>
              <div className="ag-ribbon-cell">
                <span className="ag-mono ag-ribbon-label">Refresh cycle</span>
                <span className="ag-ribbon-value">
                  {num(status?.ingest_cycle_min)}
                  {live && <small>MIN</small>}
                </span>
                <span className="ag-mono ag-ribbon-meta">Radar · lightning · model</span>
              </div>
            </div>

            <button className="ag-mono ag-scroll-cue" onClick={() => handleScrollToTier(1)} aria-label="Scroll to pipeline">
              <span>Scroll to descend</span>
              <span />
            </button>
          </div>
        </section>

        {/* ═══ 02 · PIPELINE ═══════════════════════════════════════════ */}
        <section className={`atm-act ${a2.cls}`} style={a2.style} aria-label="Data pipeline">
          <div className="ag-wrap" style={a2.inner}>
            <div className="ag-head">
              <div>
                <div className="ag-mono ag-eyebrow ag-rise" style={{ ...stagger(0), marginBottom: 18 }}>
                  <span>02 — Pipeline</span>
                </div>
                <h2 className="ag-display ag-h2 ag-rise" style={stagger(1)}>
                  From raw signal
                  <br />
                  <span className="ag-serif">to a warning.</span>
                </h2>
              </div>
              <p className="ag-body ag-rise" style={stagger(2)}>
                Four sensor families, one fused picture. Every cycle the whole chain re-runs, so the forecast never
                drifts from what the sky is actually doing.
              </p>
            </div>

            <div className="ag-pipeline">
              {PIPELINE.map((s, i) => (
                <div className="ag-step ag-rise" style={stagger(3 + i)} key={s.title}>
                  <span className="ag-step-num">0{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  <span className="ag-mono ag-step-tags">{s.tags}</span>
                </div>
              ))}
            </div>

            <div className="ag-mono ag-sources ag-rise" style={stagger(7)} aria-label="Data source status">
              {status ? (
                Object.values(status.sources).map((s) => (
                  <span key={s.label}>
                    <span className={`ag-dot ag-dot--${s.mode}`} />
                    {s.label} <em>{s.mode === "live" ? "live" : "synthetic fallback"}</em>
                  </span>
                ))
              ) : (
                <span>
                  <span className="ag-dot" />
                  Source status unavailable — backend not reachable
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ═══ 03 · HAZARDS ════════════════════════════════════════════ */}
        <section className={`atm-act ${a3.cls}`} style={a3.style} aria-label="Hazard detection">
          <div className="ag-wrap" style={a3.inner}>
            <div className="ag-head">
              <div>
                <div className="ag-mono ag-eyebrow ag-rise" style={{ ...stagger(0), marginBottom: 18 }}>
                  <span>03 — Hazards</span>
                </div>
                <h2 className="ag-display ag-h2 ag-rise" style={stagger(1)}>
                  Four hazards.
                  <br />
                  <span className="ag-serif">One console.</span>
                </h2>
              </div>
              <p className="ag-body ag-rise" style={stagger(2)}>
                Every detector is a documented physical threshold — no black box decides who gets warned.
              </p>
            </div>

            <div className="ag-hazard-table">
              <HazardRow
                i={1}
                name="Hail"
                icon={<Snowflake size={30} />}
                color="var(--ice)"
                rule={`≥ ${SPEC.hail.dbz} dBZ · ≤ ${SPEC.hail.coldTopK} K`}
                sub={`Lightning ≥ ${SPEC.hail.lightningProb} collocated`}
                text="Intense reflectivity under a very cold cloud top with active lightning — the signature of large hail."
                count={num(byType.hail ?? (live ? 0 : undefined))}
                unit="Detected now"
              />
              <HazardRow
                i={2}
                name="Lightning"
                icon={<CloudLightning size={30} />}
                color="var(--amber)"
                rule="IMD probability categories"
                sub="Blitzortung VLF network"
                text="Real strike locations fused with reflectivity, ranked by IMD's own probability categories."
                count={num(byType.lightning ?? (live ? 0 : undefined))}
                unit="Detected now"
              />
              <HazardRow
                i={3}
                name="Downburst"
                icon={<Wind size={30} />}
                color="var(--alert)"
                rule={`ΔV ≥ ${SPEC.downburstDeltaV} m/s`}
                sub="Radial-velocity couplet"
                text="Inbound-outbound Doppler velocity difference across the storm core flags damaging straight-line winds."
                count="City mode"
                unit="Regional forecast"
                tag
              />
              <HazardRow
                i={4}
                name="Cloudburst"
                icon={<CloudRain size={30} />}
                color="#7cc0ff"
                rule={`≥ ${SPEC.cloudburstMmHr} mm/hr`}
                sub="IMD very-heavy rain"
                text="pySTEPS-extrapolated rain rate crossing IMD's very-heavy threshold raises a flash-flood warning."
                count="City mode"
                unit="Regional forecast"
                tag
              />
            </div>

            <div className="ag-mono ag-models ag-rise" style={stagger(7)}>
              <span>
                <b>pySTEPS</b> · 0–{pystepsHours} h calibrated mm/hr
              </span>
              <span>
                <b>DGMR</b> · 0–{status?.models.dgmr.horizon_min ?? 90} min generative
              </span>
              <span>
                <b>SmaAt-UNet</b> · {status?.models.smaat.available ? "online" : "in training"}
              </span>
            </div>
          </div>
        </section>

        {/* ═══ 04 · CONSOLE ════════════════════════════════════════════ */}
        <section className={`atm-act ag-finale ${a4.cls}`} style={a4.style} aria-label="Enter the console">
          <div className="ag-wrap" style={a4.inner}>
            <div className="ag-deva-mark ag-rise" lang="hi" style={stagger(0)}>
              अग्रिम — आगे, हमेशा
            </div>
            <h2 className="ag-display ag-finale-title ag-rise" style={stagger(1)}>
              Ahead of
              <span className="ag-serif">
                the <em>storm.</em>
              </span>
            </h2>
            <p className="ag-body ag-rise" style={{ ...stagger(2), maxWidth: "36em" }}>
              A full-bleed GPU map, every layer time-scrubbable, and the rain itself simulated over India — built for
              the people who have to decide before the sky does.
            </p>
            <div className="ag-rise" style={stagger(3)}>
              <button className="ag-btn ag-btn--solid ag-btn--xl" onClick={onNavigateToDashboard}>
                Enter Agrim console <ArrowRight size={18} />
              </button>
            </div>
            <div className="ag-facts ag-rise" style={stagger(4)}>
              <div className="ag-fact">
                <strong>0–{SPEC.horizonHours} HRS</strong>
                <span className="ag-mono">Nowcast horizon</span>
              </div>
              <div className="ag-fact">
                <strong>{gisLayers}</strong>
                <span className="ag-mono">ISRO · MOSDAC GIS layers</span>
              </div>
              <div className="ag-fact">
                <strong>{status?.regions ?? "10"}</strong>
                <span className="ag-mono">City forecast regions</span>
              </div>
            </div>
          </div>

          <footer className="ag-mono ag-foot">
            <span>
              <b>Agrim</b> — AI/ML nowcasting of thunderstorm &amp; lightning
            </span>
            <span>
              {SIH.edition} · Problem Statement {SIH.psId} · {SIH.org} · {SIH.dept}
            </span>
          </footer>
        </section>
      </div>
    </div>
  );
}

function HazardRow(props: {
  i: number;
  name: string;
  icon: ReactNode;
  color: string;
  rule: string;
  sub: string;
  text: string;
  count: string;
  unit: string;
  tag?: boolean;
}) {
  return (
    <div
      className="ag-hazard-row ag-rise"
      style={{ ...stagger(2 + props.i), ["--hz" as string]: props.color } as CSSProperties}
    >
      <span className="ag-mono ag-hz-idx">0{props.i}</span>
      <span className="ag-hz-name">
        {props.icon}
        {props.name}
      </span>
      <span className="ag-mono ag-hz-rule">
        {props.rule}
        <small>{props.sub}</small>
      </span>
      <p className="ag-hz-desc">{props.text}</p>
      <span className={`ag-hz-count ${props.tag ? "ag-hz-count--tag" : ""}`}>
        {props.count}
        <small>{props.unit}</small>
      </span>
    </div>
  );
}
