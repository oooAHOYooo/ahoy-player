import React from "react";
import type { AlbumCardData } from "../../types/player-ui";

type CoverArtRendererProps = {
  coverType: AlbumCardData["coverType"];
  className?: string;
};

export const CoverArtRenderer: React.FC<CoverArtRendererProps> = ({
  coverType,
  className = "",
}) => {
  switch (coverType) {
    case "vinyl-beige":
      return (
        <div className={`ahoy-cover-art ahoy-cover-art--vinyl-beige ${className}`}>
          <svg viewBox="0 0 200 200" className="ahoy-cover-svg" aria-hidden="true">
            <rect width="200" height="200" rx="12" fill="#EAE5D3" />
            <circle cx="100" cy="100" r="76" fill="#18181A" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="#252528" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="62" fill="none" stroke="#2a2a2d" strokeWidth="1" />
            <circle cx="100" cy="100" r="54" fill="none" stroke="#252528" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="46" fill="none" stroke="#2a2a2d" strokeWidth="1" />
            <circle cx="100" cy="100" r="38" fill="none" stroke="#252528" strokeWidth="1" />
            {/* Center label */}
            <circle cx="100" cy="100" r="26" fill="#DCD6C2" />
            <circle cx="100" cy="100" r="8" fill="#18181A" />
          </svg>
        </div>
      );

    case "chart-teal":
      return (
        <div className={`ahoy-cover-art ahoy-cover-art--chart-teal ${className}`}>
          <svg viewBox="0 0 200 200" className="ahoy-cover-svg" aria-hidden="true">
            <defs>
              <linearGradient id="chartBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2A5B84" />
                <stop offset="100%" stopColor="#257E88" />
              </linearGradient>
              <linearGradient id="chartLine" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#E0F2FE" />
                <stop offset="100%" stopColor="#67E8F9" />
              </linearGradient>
            </defs>
            <rect width="200" height="200" rx="12" fill="url(#chartBg)" />
            <rect x="35" y="35" width="130" height="130" rx="8" fill="#1A3A52" opacity="0.45" />
            {/* Trendline with arrow */}
            <path
              d="M50 145 Q 85 140 100 115 T 145 55"
              fill="none"
              stroke="url(#chartLine)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <polygon points="140,48 152,52 148,64" fill="#67E8F9" />
          </svg>
        </div>
      );

    case "neon-mountain":
      return (
        <div className={`ahoy-cover-art ahoy-cover-art--neon-mountain ${className}`}>
          <svg viewBox="0 0 200 200" className="ahoy-cover-svg" aria-hidden="true">
            <defs>
              <linearGradient id="neonBg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#231942" />
                <stop offset="100%" stopColor="#170F2E" />
              </linearGradient>
              <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="50%" stopColor="#C084FC" />
                <stop offset="100%" stopColor="#F472B6" />
              </linearGradient>
            </defs>
            <rect width="200" height="200" rx="12" fill="url(#neonBg)" />
            {/* Geometric neon ribbon peaks */}
            <path
              d="M50 135 L85 75 L115 130 L135 95 L160 135"
              fill="none"
              stroke="url(#neonGrad)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      );

    case "vinyl-pink":
      return (
        <div className={`ahoy-cover-art ahoy-cover-art--vinyl-pink ${className}`}>
          <svg viewBox="0 0 200 200" className="ahoy-cover-svg" aria-hidden="true">
            <rect width="200" height="200" rx="12" fill="#D77A97" />
            <circle cx="100" cy="100" r="76" fill="#18181A" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="#252528" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="62" fill="none" stroke="#2a2a2d" strokeWidth="1" />
            <circle cx="100" cy="100" r="54" fill="none" stroke="#252528" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="46" fill="none" stroke="#2a2a2d" strokeWidth="1" />
            <circle cx="100" cy="100" r="38" fill="none" stroke="#252528" strokeWidth="1" />
            <circle cx="100" cy="100" r="26" fill="#BE5D7A" />
            <circle cx="100" cy="100" r="8" fill="#18181A" />
          </svg>
        </div>
      );

    case "waveform-teal":
      return (
        <div className={`ahoy-cover-art ahoy-cover-art--waveform-teal ${className}`}>
          <svg viewBox="0 0 200 200" className="ahoy-cover-svg" aria-hidden="true">
            <rect width="200" height="200" rx="12" fill="#2E4A4C" />
            <line x1="30" y1="100" x2="170" y2="100" stroke="#486D6F" strokeWidth="2" strokeDasharray="3 3" />
            {/* Waveform bars */}
            <g transform="translate(45, 60)">
              <rect x="0" y="32" width="4" height="16" rx="2" fill="#4ade80" />
              <rect x="10" y="24" width="4" height="32" rx="2" fill="#2dd4bf" />
              <rect x="20" y="14" width="4" height="52" rx="2" fill="#38bdf8" />
              <rect x="30" y="6" width="4" height="68" rx="2" fill="#818cf8" />
              <rect x="40" y="18" width="4" height="44" rx="2" fill="#c084fc" />
              <rect x="50" y="4" width="4" height="72" rx="2" fill="#f472b6" />
              <rect x="60" y="16" width="4" height="48" rx="2" fill="#fb7185" />
              <rect x="70" y="10" width="4" height="60" rx="2" fill="#f97316" />
              <rect x="80" y="22" width="4" height="36" rx="2" fill="#facc15" />
              <rect x="90" y="30" width="4" height="20" rx="2" fill="#4ade80" />
              <rect x="100" y="34" width="4" height="12" rx="2" fill="#2dd4bf" />
            </g>
          </svg>
        </div>
      );

    case "minimal-mint":
      return (
        <div className={`ahoy-cover-art ahoy-cover-art--minimal-mint ${className}`}>
          <svg viewBox="0 0 200 200" className="ahoy-cover-svg" aria-hidden="true">
            <rect width="200" height="200" rx="12" fill="#A1D2CD" />
            <g transform="translate(50, 50)">
              <rect width="100" height="100" rx="12" fill="#488D87" opacity="0.3" />
              <circle cx="75" cy="40" r="10" fill="#316F6A" />
              {/* Geometric mountain */}
              <polygon points="18,85 50,48 70,72 82,58 92,85" fill="#316F6A" />
            </g>
          </svg>
        </div>
      );

    case "vinyl-slate":
      return (
        <div className={`ahoy-cover-art ahoy-cover-art--vinyl-slate ${className}`}>
          <svg viewBox="0 0 200 200" className="ahoy-cover-svg" aria-hidden="true">
            <rect width="200" height="200" rx="12" fill="#3E6B74" />
            <circle cx="100" cy="100" r="76" fill="#18181A" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="#252528" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="62" fill="none" stroke="#2a2a2d" strokeWidth="1" />
            <circle cx="100" cy="100" r="54" fill="none" stroke="#252528" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="46" fill="none" stroke="#2a2a2d" strokeWidth="1" />
            <circle cx="100" cy="100" r="38" fill="none" stroke="#252528" strokeWidth="1" />
            <circle cx="100" cy="100" r="26" fill="#2E5259" />
            <circle cx="100" cy="100" r="8" fill="#18181A" />
          </svg>
        </div>
      );

    case "vinyl-plum":
      return (
        <div className={`ahoy-cover-art ahoy-cover-art--vinyl-plum ${className}`}>
          <svg viewBox="0 0 200 200" className="ahoy-cover-svg" aria-hidden="true">
            <rect width="200" height="200" rx="12" fill="#753046" />
            <circle cx="100" cy="100" r="76" fill="#18181A" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="#252528" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="62" fill="none" stroke="#2a2a2d" strokeWidth="1" />
            <circle cx="100" cy="100" r="54" fill="none" stroke="#252528" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="46" fill="none" stroke="#2a2a2d" strokeWidth="1" />
            <circle cx="100" cy="100" r="38" fill="none" stroke="#252528" strokeWidth="1" />
            <circle cx="100" cy="100" r="26" fill="#582133" />
            <circle cx="100" cy="100" r="8" fill="#18181A" />
          </svg>
        </div>
      );

    case "target-black":
      return (
        <div className={`ahoy-cover-art ahoy-cover-art--target-black ${className}`}>
          <svg viewBox="0 0 200 200" className="ahoy-cover-svg" aria-hidden="true">
            <rect width="200" height="200" rx="12" fill="#0D0E12" />
            <g transform="translate(100, 100)">
              {/* Radio wave brackets */}
              <path d="M -45 -30 C -60 -15 -60 15 -45 30" fill="none" stroke="#D94676" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M -30 -20 C -40 -10 -40 10 -30 20" fill="none" stroke="#D94676" strokeWidth="4.5" strokeLinecap="round" />
              <circle cx="0" cy="0" r="16" fill="none" stroke="#D94676" strokeWidth="4.5" />
              <circle cx="0" cy="0" r="7" fill="#D94676" />
              <path d="M 30 -20 C 40 -10 40 10 30 20" fill="none" stroke="#D94676" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 45 -30 C 60 -15 60 15 45 30" fill="none" stroke="#D94676" strokeWidth="4.5" strokeLinecap="round" />
            </g>
          </svg>
        </div>
      );

    default:
      return (
        <div className={`ahoy-cover-art ${className}`}>
          <div className="ahoy-cover-fallback" />
        </div>
      );
  }
};
