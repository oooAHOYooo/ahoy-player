import React from "react";
import { LeftSidebar } from "../sidebar/LeftSidebar";
import { AlbumGrid, defaultMockAlbums } from "../grid/AlbumGrid";
import { QueueDrawer } from "../drawer/QueueDrawer";
import { ThemeStudio } from "../drawer/ThemeStudio/ThemeStudio";
import { LyricsDrawer } from "../drawer/LyricsDrawer";
import { AudioVisualizerPanel } from "../visualizer/AudioVisualizerPanel";
import { AhoyDialPanel } from "../dial/AhoyDialPanel";
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
  onScanMp3s?: () => void;
  isScanning?: boolean;
  albums?: AlbumCardData[];
  nauticalThemes?: NauticalTheme[];
  activeThemeId?: string;
  onSelectTheme?: (themeId: string) => void;
  colorVariables: ColorVariable[];
  onChangeColor: (id: string, color: string) => void;
  isAdvanced: boolean;
  onToggleAdvanced: (val: boolean) => void;
  cssCode: string;
  onChangeCss: (val: string) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onNextTrack?: () => void;
  onPreviousTrack?: () => void;
  onSeek?: (ratio: number) => void;
  positionMs?: number;
  durationMs?: number;
  volume?: number;
};

export const ColumnPanelRenderer: React.FC<ColumnPanelRendererProps> = ({
  panelId,
  activeNav,
  onSelectNav,
  selectedAlbum,
  onSelectAlbum,
  onScanMp3s,
  isScanning,
  albums,
  nauticalThemes,
  activeThemeId,
  onSelectTheme,
  colorVariables,
  onChangeColor,
  isAdvanced,
  onToggleAdvanced,
  cssCode,
  onChangeCss,
  isPlaying = false,
  onTogglePlay = () => {},
  onNextTrack = () => {},
  onPreviousTrack = () => {},
  onSeek = () => {},
  positionMs = 0,
  durationMs = 180000,
  volume = 0.8,
}) => {
  switch (panelId) {
    case "sidebar":
      return (
        <LeftSidebar
          activeId={activeNav}
          onSelect={onSelectNav}
          onScanMp3s={onScanMp3s}
        />
      );

    case "grid":
      return (
        <AlbumGrid
          albums={albums}
          selectedId={selectedAlbum.id}
          onSelectAlbum={onSelectAlbum}
          onScanMp3s={onScanMp3s}
          isScanning={isScanning}
        />
      );

    case "queue":
      return (
        <div className="ahoy-column-embed-drawer">
          <QueueDrawer
            onClose={() => {}}
            queue={albums ?? defaultMockAlbums}
            currentTrackId={selectedAlbum.id}
            onSelectTrack={onSelectAlbum}
          />
        </div>
      );

    case "visualizer":
      return (
        <div className="ahoy-column-embed-drawer">
          <AudioVisualizerPanel
            isPlaying={isPlaying}
            nowPlaying={selectedAlbum}
            volume={volume}
          />
        </div>
      );

    case "dial":
      return (
        <div className="ahoy-column-embed-drawer">
          <AhoyDialPanel
            isPlaying={isPlaying}
            onTogglePlay={onTogglePlay}
            onNextTrack={onNextTrack}
            onPreviousTrack={onPreviousTrack}
            onSeek={onSeek}
            positionMs={positionMs}
            durationMs={durationMs}
            nowPlaying={selectedAlbum}
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
