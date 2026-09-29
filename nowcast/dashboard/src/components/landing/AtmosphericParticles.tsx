import { useEffect, useRef } from "react";

interface AtmosphericParticlesProps {
  scrollProgress: number; // 0.0 to 1.0
  prefersReducedMotion?: boolean;
}

export default function AtmosphericParticles({
  scrollProgress,
  prefersReducedMotion = false,
}: AtmosphericParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef(scrollProgress);
  scrollRef.current = scrollProgress;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle pools:
    // 1. Stratospheric Ice Crystals (Zone 1 & 2)
    const crystals = Array.from({ length: 65 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 1 + Math.random() * 2,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: 0.2 + Math.random() * 0.5,
      alpha: 0.2 + Math.random() * 0.6,
    }));

    // 2. Rain Streaks (Zone 3)
    const rainDrops = Array.from({ length: 120 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: 18 + Math.random() * 26,
      speedY: 16 + Math.random() * 14,
      speedX: 2 + Math.random() * 3, // Wind shear
      alpha: 0.2 + Math.random() * 0.4,
    }));

    // 3. Cyclone Eye Vortex Dust (Zone 4)
    const vortexDust = Array.from({ length: 90 }, () => {
      const radius = 40 + Math.random() * (Math.min(width, height) * 0.45);
      const angle = Math.random() * Math.PI * 2;
      return {
        radius,
        angle,
        speed: (0.008 / Math.sqrt(radius / 50 + 1)) * (0.8 + Math.random() * 0.4),
        size: 1.2 + Math.random() * 2.2,
        alpha: 0.25 + Math.random() * 0.5,
      };
    });

    let animId: number;
    let lightningTimer = 0;
    let nextLightning = 3.5;
    let flashIntensity = 0;

    const render = () => {
      animId = requestAnimationFrame(render);
      ctx.clearRect(0, 0, width, height);

      const p = scrollRef.current;

      // ── Lightning in Storm Zone (p: 0.62 - 0.86) ──────────────────────────
      if (p > 0.62 && p < 0.86 && !prefersReducedMotion) {
        lightningTimer += 0.016;
        if (lightningTimer > nextLightning) {
          // Trigger realistic multi-burst lightning flash
          flashIntensity = Math.random() > 0.4 ? 0.38 : 0.65;
          nextLightning = 2.8 + Math.random() * 4.2;
          lightningTimer = 0;
        }

        if (flashIntensity > 0) {
          ctx.fillStyle = `rgba(180, 220, 255, ${flashIntensity})`;
          ctx.fillRect(0, 0, width, height);
          flashIntensity *= 0.72; // Fast decay
          if (flashIntensity < 0.02) flashIntensity = 0;
        }
      }

      // ── Zone 1 & 2: Stratospheric Ice Crystals ─────────────────────────────
      if (p < 0.58) {
        const zoneAlpha = p < 0.25 ? 1 : Math.max(0, 1 - (p - 0.25) / 0.3);
        ctx.fillStyle = "#cbe4ff";
        for (const c of crystals) {
          if (!prefersReducedMotion) {
            c.y += c.speedY;
            c.x += c.speedX;
            if (c.y > height) {
              c.y = -10;
              c.x = Math.random() * width;
            }
            if (c.x > width) c.x = 0;
            if (c.x < 0) c.x = width;
          }

          ctx.globalAlpha = c.alpha * zoneAlpha;
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── Zone 3: Rain Streaks ───────────────────────────────────────────────
      if (p > 0.62 && p < 0.88) {
        const rainAlpha = Math.sin(((p - 0.62) / 0.26) * Math.PI);
        ctx.strokeStyle = "#8ab8e6";
        ctx.lineWidth = 1.2;

        for (const r of rainDrops) {
          if (!prefersReducedMotion) {
            r.y += r.speedY;
            r.x += r.speedX;
            if (r.y > height) {
              r.y = -30;
              r.x = Math.random() * width;
            }
            if (r.x > width) r.x = 0;
          }

          ctx.globalAlpha = r.alpha * rainAlpha;
          ctx.beginPath();
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x + r.speedX * 2, r.y + r.length);
          ctx.stroke();
        }
      }

      // ── Zone 4: Swirling Eye Particles ─────────────────────────────────────
      if (p > 0.82) {
        const eyeAlpha = Math.min(1, (p - 0.82) / 0.12);
        const centerX = width * 0.5;
        const centerY = height * 0.5;

        ctx.fillStyle = "#9bc4ec";
        for (const v of vortexDust) {
          if (!prefersReducedMotion) {
            v.angle -= v.speed;
            v.radius -= 0.3; // Gentle inward pull
            if (v.radius < 25) {
              v.radius = Math.min(width, height) * 0.42;
              v.angle = Math.random() * Math.PI * 2;
            }
          }

          const px = centerX + Math.cos(v.angle) * v.radius;
          const py = centerY + Math.sin(v.angle) * (v.radius * 0.62); // Isometric tilt

          ctx.globalAlpha = v.alpha * eyeAlpha;
          ctx.beginPath();
          ctx.arc(px, py, v.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1.0;
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5,
        pointerEvents: "none",
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}
