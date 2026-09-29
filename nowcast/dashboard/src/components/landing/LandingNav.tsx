import { ArrowUpRight } from "lucide-react";
import type { LinkState } from "../../hooks/useSystemStatus";

interface LandingNavProps {
  onNavigateToDashboard: () => void;
  onScrollToTier: (tierIndex: number) => void;
  activeTier: number;
  link: LinkState;
}

const TIERS = [
  { n: "01", label: "Overview" },
  { n: "02", label: "Pipeline" },
  { n: "03", label: "Hazards" },
  { n: "04", label: "Console" },
];

const LINK_LABEL: Record<LinkState, string> = {
  connecting: "Linking…",
  online: "Backend online",
  offline: "Backend offline",
};

export default function LandingNav({ onNavigateToDashboard, onScrollToTier, activeTier, link }: LandingNavProps) {
  return (
    <header className="atm-nav-wrapper" role="banner">
      <nav className="atm-nav" aria-label="Main navigation">
        <button className="atm-brand" onClick={() => onScrollToTier(0)} aria-label="Agrim — back to top">
          <img src="/agrim-mark.svg" width={36} height={36} alt="" />
          <span className="atm-brand-word">AGRIM</span>
          <span className="atm-brand-deva" lang="hi">अग्रिम</span>
        </button>

        <div className="atm-tier-links">
          {TIERS.map((t, i) => (
            <button
              key={t.n}
              className={`atm-tier-btn ${activeTier === i ? "atm-tier-btn--active" : ""}`}
              onClick={() => onScrollToTier(i)}
              aria-current={activeTier === i ? "true" : undefined}
            >
              <i>{t.n}</i>
              {t.label}
            </button>
          ))}
        </div>

        <div className="atm-nav-actions">
          <span className="ag-mono ag-link-state" role="status">
            <span className={`ag-dot ag-dot--${link === "connecting" ? "idle" : link}`} />
            {LINK_LABEL[link]}
          </span>
          <button className="ag-btn ag-btn--solid" onClick={onNavigateToDashboard}>
            Launch console <ArrowUpRight size={15} />
          </button>
        </div>
      </nav>
    </header>
  );
}
