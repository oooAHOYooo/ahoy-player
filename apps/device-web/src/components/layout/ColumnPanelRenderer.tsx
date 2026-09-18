import React from "react";
import { LeftSidebar } from "../sidebar/LeftSidebar";
import { AlbumGrid, defaultMockAlbums } from "../grid/AlbumGrid";
import { QueueDrawer } from "../drawer/QueueDrawer";
import { ThemeStudio } from "../drawer/ThemeStudio/ThemeStudio";
import { LyricsDrawer } from "../drawer/LyricsDrawer";
import type {
  WorkspacePanelId,
  NavItemId,
  AlbumCardData,
  ColorVariable,
  NauticalTheme,
} from "../../types/player-ui";

type ColumnPanelRendererProps = {
  panelId: WorkspacePanelId;
  activeNav: NavItemId;
  onSelectNav: (id: NavItemId) => void;
  selectedAlbum: AlbumCardData;
  onSelectAlbum: (card: AlbumCardData) => void;
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

export const ColumnPanelRenderer: React.FC<ColumnPanelRendererProps> = ({
  panelId,
  activeNav,
  onSelectNav,
  selectedAlbum,
  onSelectAlbum,
  nauticalThemes,
  activeThemeId,
  onSelectTheme,
  colorVariables,
  onChangeColor,
  isAdvanced,
  onToggleAdvanced,
  cssCode,
  onChangeCss,
}) => {
  switch (panelId) {
    case "sidebar":
      return <LeftSidebar activeId={activeNav} onSelect={onSelectNav} />;

    case "grid":
      return (
        <AlbumGrid
          selectedId={selectedAlbum.id}
          onSelectAlbum={onSelectAlbum}
        />
      );

    case "queue":
      return (
        <div className="ahoy-column-embed-drawer">
          <QueueDrawer
            onClose={() => {}}
            queue={defaultMockAlbums}
            currentTrackId={selectedAlbum.id}
            onSelectTrack={onSelectAlbum}
          />
        </div>
      );

    case "theme-studio":
      return (
        <div className="ahoy-column-embed-drawer">
          <ThemeStudio
            onClose={() => {}}
            nauticalThemes={nauticalThemes}
            activeThemeId={activeThemeId}
            onSelectTheme={onSelectTheme}
            colorVariables={colorVariables}
            onChangeColor={onChangeColor}
            isAdvanced={isAdvanced}
            onToggleAdvanced={onToggleAdvanced}
            cssCode={cssCode}
            onChangeCss={onChangeCss}
          />
        </div>
      );

    case "lyrics":
      return (
        <div className="ahoy-column-embed-drawer">
          <LyricsDrawer
            onClose={() => {}}
            title={selectedAlbum.title}
            artist={selectedAlbum.artist}
          />
        </div>
      );

    default:
      return null;
  }
};
