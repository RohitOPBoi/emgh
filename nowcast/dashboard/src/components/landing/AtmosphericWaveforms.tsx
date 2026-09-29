import { useEffect, useRef } from "react";

interface AtmosphericWaveformsProps {
  scrollProgress: number;
  prefersReducedMotion?: boolean;
}

export default function AtmosphericWaveforms({
  scrollProgress,
  prefersReducedMotion = false,
}: AtmosphericWaveformsProps) {
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

    let animId: number;
    let time = 0;

    const render = () => {
      animId = requestAnimationFrame(render);
      if (!prefersReducedMotion) {
        time += 0.012; // Smooth continuous wave drift
      }

      ctx.clearRect(0, 0, width, height);
      const p = scrollRef.current;

      // ── 1. Delicate Horizontal Oscillogram Waveform Texture ────────────────
      const spectrogramRows = 14;
      for (let r = 0; r < spectrogramRows; r++) {
        const normY = (r + 0.5) / spectrogramRows;
        const baseY = height * normY;
        const speed = (0.4 + (r % 3) * 0.2) * time;
        const rowAmp = 6 + (r % 4) * 3;

        ctx.beginPath();
        ctx.strokeStyle =
          r % 2 === 0
            ? "rgba(56, 189, 248, 0.04)"
            : "rgba(148, 163, 184, 0.03)";
        ctx.lineWidth = 0.8;

        for (let x = 0; x <= width; x += 16) {
          const wavePhase = x * 0.003 + speed + r;
          const packet = Math.sin(x * 0.0012 + time * 0.2 + r * 0.5);
          const yOffset = Math.sin(wavePhase) * rowAmp * (0.4 + packet * 0.6);

          if (x === 0) ctx.moveTo(x, baseY + yOffset);
          else ctx.lineTo(x, baseY + yOffset);
        }
        ctx.stroke();
      }

      // ── 2. Primary Undulating Atmospheric Wave-Forms ───────────────────────
      const waveCount = 6;
      for (let i = 0; i < waveCount; i++) {
        ctx.beginPath();
        const baseNormY = 0.18 + (i / waveCount) * 0.68;
        const baseY = height * baseNormY;
        const freq1 = 0.0014 + i * 0.0004;
        const freq2 = 0.0028 - i * 0.0003;
        const amp = 16 + i * 10 + Math.sin(time * 0.4 + i * 1.5) * 6;
        const speed = (0.5 + i * 0.25) * time;

        let strokeColor = "rgba(56, 189, 248, 0.09)";
        if (p > 0.55 && p < 0.82) {
          strokeColor = i % 2 === 0 ? "rgba(245, 158, 11, 0.12)" : "rgba(239, 68, 68, 0.08)";
        } else if (p >= 0.82) {
          strokeColor = "rgba(16, 185, 129, 0.11)";
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = i === 1 || i === 3 ? 1.5 : 0.9;

        for (let x = 0; x <= width; x += 10) {
          const scrollMod = Math.sin(x * 0.0018 + p * Math.PI * 3) * 12;
          const y =
            baseY +
            Math.sin(x * freq1 + speed) * amp +
            Math.cos(x * freq2 - speed * 0.7) * (amp * 0.45) +
            scrollMod;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // ── 3. Pulsing Atmospheric Pressure Wave Rings (Concentric Isobars) ──────
      const focalX = width * (0.5 + (0.5 - p) * 0.15);
      const focalY = height * (0.5 + (p - 0.5) * 0.12);
      const ringCount = 3;

      for (let r = 0; r < ringCount; r++) {
        const ringProg = ((time * 0.18 + r / ringCount) % 1.0);
        const radius = ringProg * (Math.min(width, height) * 0.65);
        const alpha = (1.0 - ringProg) * 0.09;

        ctx.beginPath();
        ctx.arc(focalX, focalY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 14]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
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
      className="atm-waveform-canvas"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2,
        pointerEvents: "none",
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}
