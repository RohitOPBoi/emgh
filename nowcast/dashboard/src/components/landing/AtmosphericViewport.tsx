import { useEffect, useRef } from "react";

interface AtmosphericViewportProps {
  scrollProgress: number; // 0.0 to 1.0
  prefersReducedMotion?: boolean;
}

export default function AtmosphericViewport({
  scrollProgress,
  prefersReducedMotion = false,
}: AtmosphericViewportProps) {
  const cycloneRotationRef = useRef(0);
  const cycloneElemRef = useRef<HTMLDivElement>(null);

  // Continuous subtle rotational drift for the cyclone epicenter (Scene 4)
  useEffect(() => {
    if (prefersReducedMotion) return;
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      animId = requestAnimationFrame(loop);
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      cycloneRotationRef.current += delta * 1.8; // ~1.8 degrees per second continuous spin
      if (cycloneElemRef.current) {
        cycloneElemRef.current.style.setProperty(
          "--continuous-rot",
          `${cycloneRotationRef.current}deg`
        );
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [prefersReducedMotion]);

  const p = scrollProgress;

  // ── LAYER CALCULATIONS ───────────────────────────────────────────────────

  // Scene 1: Earth + Clouds (p: 0.00 -> 0.35)
  // Earth slowly translates upward as camera dives down
  const s1Y = -p * 110; // 0% down to -38%
  const s1Scale = 1.0 + p * 0.35;
  const s1Opacity = p < 0.22 ? 1 : Math.max(0, 1 - (p - 0.22) / 0.12);

  // Scene 2: Cloud Ocean (p: 0.20 -> 0.68)
  // Enters as Earth drifts away, expands, and camera dives into the cloud canyon
  let s2Y = (0.34 - Math.min(0.55, p)) * 65;
  let s2Scale = 1.0;
  if (p > 0.45) {
    // Zooming straight into the cloud opening
    s2Scale = 1.0 + Math.pow((p - 0.45) / 0.22, 1.8) * 1.5;
  }
  const s2Opacity =
    p < 0.18
      ? 0
      : p < 0.32
        ? (p - 0.18) / 0.14
        : p < 0.58
          ? 1
          : Math.max(0, 1 - (p - 0.58) / 0.1);

  // Cloud Dive Vapor Veil (p: 0.52 -> 0.72)
  // Simulates camera passing through dense zero-visibility cloud vapor
  let vaporOpacity = 0;
  let vaporColor = "rgba(225, 238, 252, 0.95)";
  if (p >= 0.52 && p <= 0.72) {
    if (p < 0.65) {
      // Cloud envelope: white bright moisture
      vaporOpacity = ((p - 0.52) / 0.13) * 0.94;
      vaporColor = "rgba(225, 238, 252, 0.95)";
    } else {
      // Punching through bottom into dark storm: shifts to charcoal storm indigo
      const t = (p - 0.65) / 0.07;
      vaporOpacity = 0.94 * (1 - t);
      vaporColor = "rgba(7, 12, 22, 0.98)";
    }
  }

  // Scene 3: Dark Thunderstorm & Tornado (p: 0.64 -> 0.88)
  const s3Y = (0.74 - p) * 45;
  const s3Scale = 1.02 + (p - 0.65) * 0.25;
  const s3Opacity =
    p < 0.62
      ? 0
      : p < 0.71
        ? (p - 0.62) / 0.09
        : p < 0.82
          ? 1
          : Math.max(0, 1 - (p - 0.82) / 0.08);

  // Scene 4: Cyclone Epicenter (p: 0.80 -> 1.00)
  const s4Opacity = p < 0.78 ? 0 : Math.min(1, (p - 0.78) / 0.1);
  const s4Scale = 1.0 + (p - 0.8) * 0.22;
  const s4ScrollRot = (p - 0.8) * 40; // degrees from scroll scrub

  return (
    <div className="atm-viewport-root" aria-hidden="true">
      {/* ══════════════════════════════════════════════════════════════════════
          SCENE 01 — EARTH SURROUNDED BY CLOUDS
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="atm-stage-layer"
        style={{
          opacity: s1Opacity,
          transform: `translate3d(0, ${s1Y}px, 0) scale(${s1Scale})`,
          zIndex: 1,
        }}
      >
        <img
          src="/landing/scene1_earth.png"
          alt=""
          className="atm-stage-img atm-stage-img--earth"
          loading="eager"
        />
        {/* Subtle high-altitude limb atmosphere glow */}
        <div className="atm-earth-atmosphere-glow" />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SCENE 02 — BRIGHT CLOUD OCEAN / AERIAL VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="atm-stage-layer"
        style={{
          opacity: s2Opacity,
          transform: `translate3d(0, ${s2Y}px, 0) scale(${s2Scale})`,
          zIndex: 2,
        }}
      >
        <img
          src="/landing/scene2_clouds.png"
          alt=""
          className="atm-stage-img atm-stage-img--clouds"
          loading="eager"
        />
        <div className="atm-cloud-sun-haze" />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TRANSITION: ZERO-VISIBILITY CLOUD DIVE VAPOR VEIL
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="atm-vapor-veil"
        style={{
          opacity: vaporOpacity,
          backgroundColor: vaporColor,
          zIndex: 3,
        }}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          SCENE 03 — DARK THUNDERSTORM / TORNADO SUPERCELL
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="atm-stage-layer"
        style={{
          opacity: s3Opacity,
          transform: `translate3d(0, ${s3Y}px, 0) scale(${s3Scale})`,
          zIndex: 4,
        }}
      >
        <img
          src="/landing/scene3_storm.png"
          alt=""
          className="atm-stage-img atm-stage-img--storm"
          loading="eager"
        />
        <div className="atm-storm-vignette" />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SCENE 04 — TOP-DOWN ROTATING CYCLONE EPICENTER
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        ref={cycloneElemRef}
        className="atm-stage-layer"
        style={{
          opacity: s4Opacity,
          transform: `scale(${s4Scale})`,
          zIndex: 5,
        }}
      >
        <div
          className="atm-cyclone-rotator"
          style={{
            transform: `rotate(calc(var(--continuous-rot, 0deg) + ${s4ScrollRot}deg))`,
          }}
        >
          <img
            src="/landing/scene4_cyclone.png"
            alt=""
            className="atm-stage-img atm-stage-img--cyclone"
            loading="eager"
          />
        </div>
        {/* Pulsing deep convective eye glow */}
        <div className="atm-cyclone-eye-glow" />
      </div>
    </div>
  );
}
