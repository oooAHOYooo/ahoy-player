import { useState, useEffect } from "react";
import type { ColorVariable, DockTabId, NauticalTheme } from "../types/player-ui";

export const NAUTICAL_THEMES: NauticalTheme[] = [
  {
    id: "deep-harbor",
    name: "Deep Harbor",
    subtitle: "Abyssal Navy & Bioluminescent Teal",
    colors: {
      background: "#0c1926",
      surface: "#13263a",
      text: "#e2f1f8",
      accent: "#2dd4bf",
      border: "#1e3b56",
      deck: "#0e1e2e",
    },
  },
  {
    id: "captains-brass",
    name: "Captain's Brass",
    subtitle: "Sea Chest Slate & Lantern Gold",
    colors: {
      background: "#111b1d",
      surface: "#1c2d30",
      text: "#f4f0df",
      accent: "#e5a93b",
      border: "#2d464b",
      deck: "#152225",
    },
  },
  {
    id: "sailors-warning",
    name: "Sailor's Warning",
    subtitle: "Crimson Dusk & Lighthouse Coral",
    colors: {
      background: "#1c1219",
      surface: "#2c1b26",
      text: "#faedf2",
      accent: "#f45866",
      border: "#48293d",
      deck: "#20151d",
    },
  },
];

const defaultColorVariables: ColorVariable[] = [
  { id: "color-1", name: "Primary Variable", value: "#FFFFEE" },
  { id: "color-2", name: "Secondary Variable", value: "#300585" },
  { id: "color-3", name: "Accent Variable", value: "#A99180" },
];

const defaultCustomCss = `1 .code {
2   codios: css {
3     colors: attor;
4     color: #ipx;
5   }
6 }`;

export function useThemeStudio() {
  const [activeTab, setActiveTab] = useState<DockTabId | null>("queue"); // Queue shows first!
  const [activeThemeId, setActiveThemeId] = useState<string>("deep-harbor");
  const [colorVariables, setColorVariables] = useState<ColorVariable[]>(defaultColorVariables);
  const [isAdvanced, setIsAdvanced] = useState(true);
  const [customCss, setCustomCss] = useState(defaultCustomCss);

  // Apply nautical theme colors
  const applyNauticalTheme = (themeId: string) => {
    const found = NAUTICAL_THEMES.find((t) => t.id === themeId);
    if (!found) return;

    setActiveThemeId(themeId);

    // Update CSS variables
    const root = document.documentElement;
    root.style.setProperty("--ahoy-bg-window", found.colors.background);
    root.style.setProperty("--ahoy-bg-app", found.colors.background);
    root.style.setProperty("--ahoy-bg-sidebar", found.colors.surface);
    root.style.setProperty("--ahoy-bg-center", found.colors.background);
    root.style.setProperty("--ahoy-bg-drawer", found.colors.surface);
    root.style.setProperty("--ahoy-bg-deck", found.colors.deck);
    root.style.setProperty("--ahoy-accent-teal", found.colors.accent);
    root.style.setProperty("--ahoy-text-main", found.colors.text);
    root.style.setProperty("--ahoy-border-subtle", found.colors.border);

    // Update color variables
    setColorVariables([
      { id: "color-1", name: "Theme Text", value: found.colors.text },
      { id: "color-2", name: "Theme Surface", value: found.colors.surface },
      { id: "color-3", name: "Theme Accent", value: found.colors.accent },
    ]);
  };

  // Update a specific color variable
  const updateColorVariable = (id: string, value: string) => {
    setColorVariables((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value } : item))
    );
  };

  // Sync CSS variables with root document
  useEffect(() => {
    const root = document.documentElement;
    colorVariables.forEach((cv, idx) => {
      root.style.setProperty(`--user-color-${idx + 1}`, cv.value);
    });
  }, [colorVariables]);

  const handleSelectTab = (tab: DockTabId) => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

  const handleCloseDrawer = () => {
    setActiveTab(null);
  };

  return {
    activeTab,
    setActiveTab,
    activeThemeId,
    applyNauticalTheme,
    nauticalThemes: NAUTICAL_THEMES,
    handleSelectTab,
    handleCloseDrawer,
    colorVariables,
    updateColorVariable,
    isAdvanced,
    setIsAdvanced,
    customCss,
    setCustomCss,
  };
}
