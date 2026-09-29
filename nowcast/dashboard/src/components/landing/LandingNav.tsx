import { ArrowUpRight, Radio } from "lucide-react";

interface LandingNavProps {
  onNavigateToDashboard: () => void;
  onScrollToTier: (tierIndex: number) => void;
  activeTier: number;
}

export default function LandingNav({
  onNavigateToDashboard,
  onScrollToTier,
  activeTier,
}: LandingNavProps) {
  const tiers = [
    { label: "01 SENSORS", index: 0 },
    { label: "02 PIPELINE", index: 1 },
    { label: "03 HAZARDS", index: 2 },
    { label: "04 TERMINAL", index: 3 },
  ];

  return (
    <header className="atm-nav-wrapper" role="banner">
      <nav className="atm-nav" aria-label="Main atmospheric navigation">
        {/* Brand Identity */}
        <div className="atm-brand" onClick={() => onScrollToTier(0)}>
          <div className="atm-brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#7dd3fc" strokeWidth="1.5" />
              <path
                d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"
                stroke="#38bdf8"
                strokeWidth="1.2"
                strokeOpacity="0.75"
              />
            </svg>
          </div>
          <div className="atm-brand-text">
            <span className="atm-brand-name">MEGH</span>
            <span className="atm-brand-sub">OPS NOWCAST v2.4</span>
          </div>
        </div>

        {/* Atmospheric Tiers */}
        <div className="atm-tier-links" role="tablist">
          {tiers.map((t) => (
            <button
              key={t.label}
              className={`atm-tier-btn ${activeTier === t.index ? "atm-tier-btn--active" : ""}`}
              onClick={() => onScrollToTier(t.index)}
              role="tab"
              aria-selected={activeTier === t.index}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Right CTA & Telemetry Pill */}
        <div className="atm-nav-actions">
          <div className="atm-status-pill">
            <Radio size={12} className="atm-pulse-icon" />
            <span>28 DWR · LIVE</span>
          </div>

          <button
            className="atm-nav-enter-btn"
            onClick={onNavigateToDashboard}
            aria-label="Enter the weather operations dashboard"
          >
            <span>ENTER TERMINAL</span>
            <ArrowUpRight size={14} />
          </button>
        </div>
      </nav>
    </header>
  );
}
