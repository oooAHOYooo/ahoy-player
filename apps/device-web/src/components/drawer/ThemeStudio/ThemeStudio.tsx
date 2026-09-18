import React from "react";
import { DrawerPanel } from "../DrawerPanel";
import { ColorVariables } from "./ColorVariables";
import { NauticalThemesSection } from "./NauticalThemesSection";
import { WidgetLibrary } from "./WidgetLibrary";
import { CustomCssEditor } from "./CustomCssEditor";
import type { ColorVariable, NauticalTheme } from "../../../types/player-ui";

type ThemeStudioProps = {
  onClose: () => void;
  nauticalThemes?: NauticalTheme[];
  activeThemeId?: string;
  onSelectTheme?: (themeId: string) => void;
  colorVariables: ColorVariable[];
  onChangeColor: (id: string, color: string) => void;
  isAdvanced: boolean;
  onToggleAdvanced: (val: boolean) => void;
  cssCode: string;
  onChangeCss: (val: string) => void;
};

export const ThemeStudio: React.FC<ThemeStudioProps> = ({
  onClose,
  nauticalThemes = [],
  activeThemeId = "deep-harbor",
  onSelectTheme = () => {},
  colorVariables,
  onChangeColor,
  isAdvanced,
  onToggleAdvanced,
  cssCode,
  onChangeCss,
}) => {
  return (
    <DrawerPanel title="Theme Studio" onClose={onClose}>
      {nauticalThemes.length > 0 && (
        <NauticalThemesSection
          themes={nauticalThemes}
          activeThemeId={activeThemeId}
          onSelectTheme={onSelectTheme}
        />
      )}
      <ColorVariables
        variables={colorVariables}
        onChangeColor={onChangeColor}
      />
      <WidgetLibrary />
      <CustomCssEditor
        isAdvanced={isAdvanced}
        onToggleAdvanced={onToggleAdvanced}
        cssCode={cssCode}
        onChangeCss={onChangeCss}
      />
    </DrawerPanel>
  );
};
