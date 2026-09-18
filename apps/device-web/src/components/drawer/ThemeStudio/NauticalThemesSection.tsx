import React from "react";
import type { NauticalTheme } from "../../../types/player-ui";

type NauticalThemesSectionProps = {
  themes: NauticalTheme[];
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
};

export const NauticalThemesSection: React.FC<NauticalThemesSectionProps> = ({
  themes,
  activeThemeId,
  onSelectTheme,
}) => {
  return (
    <div className="ahoy-theme-section ahoy-nautical-themes">
      <h3 className="ahoy-theme-section-title">Nautical Themes</h3>
      <div className="ahoy-nautical-list">
        {themes.map((theme) => {
          const isSelected = theme.id === activeThemeId;
          return (
            <button
              key={theme.id}
              type="button"
              className={`ahoy-nautical-card ${isSelected ? "is-selected" : ""}`}
              onClick={() => onSelectTheme(theme.id)}
              aria-label={`Select ${theme.name} nautical theme`}
            >
              <div className="ahoy-nautical-header">
                <strong className="ahoy-nautical-name">{theme.name}</strong>
                {isSelected && <span className="ahoy-nautical-check">✓ Active</span>}
              </div>
              <span className="ahoy-nautical-subtitle">{theme.subtitle}</span>
              <div className="ahoy-nautical-swatches">
                <span
                  className="ahoy-nautical-swatch"
                  style={{ backgroundColor: theme.colors.background }}
                  title="Background"
                />
                <span
                  className="ahoy-nautical-swatch"
                  style={{ backgroundColor: theme.colors.surface }}
                  title="Surface"
                />
                <span
                  className="ahoy-nautical-swatch"
                  style={{ backgroundColor: theme.colors.accent }}
                  title="Accent"
                />
                <span
                  className="ahoy-nautical-swatch"
                  style={{ backgroundColor: theme.colors.text }}
                  title="Text"
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
