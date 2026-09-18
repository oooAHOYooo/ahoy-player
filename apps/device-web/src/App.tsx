import React, { useState } from "react";
import { createEmptyLibrary } from "@ahoy/player-core";
import {
  BrowserAudioPlaybackAdapter,
  BrowserFileImportAdapter,
  LocalStoragePersistenceAdapter,
} from "@ahoy/player-web-adapters";
import { useAhoyPlayer } from "@ahoy/player-react";

import { WindowTitleBar } from "./components/chrome/WindowTitleBar";
import { ColumnHeader } from "./components/layout/ColumnHeader";
import { ColumnPanelRenderer } from "./components/layout/ColumnPanelRenderer";
import { UtilityDock } from "./components/dock/UtilityDock";
import { BottomPlayerBar } from "./components/player/BottomPlayerBar";
import { defaultMockAlbums } from "./components/grid/AlbumGrid";
import { useThemeStudio } from "./hooks/useThemeStudio";
import { useWorkspaceColumns } from "./hooks/useWorkspaceColumns";
import type { NavItemId, AlbumCardData, DockTabId } from "./types/player-ui";

const fileImport = new BrowserFileImportAdapter();
const persistence = new LocalStoragePersistenceAdapter("ahoy-player:web:v1");
const playbackAdapter = new BrowserAudioPlaybackAdapter();

export function App() {
  const model = useAhoyPlayer({
    initialLibrary: createEmptyLibrary(),
    fileImport,
    persistence,
    playbackAdapter,
  });

  // Navigation state
  const [activeNav, setActiveNav] = useState<NavItemId>("artists");

  // 3-Column Customizable Workspace
  // Default: Column 0 = Library, Column 1 = Grid, Column 2 = Queue (Queue shows first!)
  const { columns, setColumnPanel, swapColumns } = useWorkspaceColumns();
  const [draggingCol, setDraggingCol] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);

  // Track selection state
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumCardData>(defaultMockAlbums[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);

  // Theme Studio and color variables state
  const {
    activeTab,
    setActiveTab,
    activeThemeId,
    applyNauticalTheme,
    nauticalThemes,
    colorVariables,
    updateColorVariable,
    isAdvanced,
    setIsAdvanced,
    customCss,
    setCustomCss,
  } = useThemeStudio();

  // Playback handlers
  const handleSelectAlbum = (card: AlbumCardData) => {
    setSelectedAlbum(card);
    setIsPlaying(true);
    setPositionMs(0);

    const libraryTrack = model.library.tracks.find(
      (t) => t.title.toLowerCase() === card.title.toLowerCase()
    );
    if (libraryTrack) {
      model.playTrack(libraryTrack.id);
    }
  };

  const handleTogglePlay = () => {
    if (model.nowPlaying) {
      model.togglePlayback();
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handlePrevious = () => {
    const currentIndex = defaultMockAlbums.findIndex((a) => a.id === selectedAlbum.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : defaultMockAlbums.length - 1;
    handleSelectAlbum(defaultMockAlbums[prevIndex]);
  };

  const handleNext = () => {
    const currentIndex = defaultMockAlbums.findIndex((a) => a.id === selectedAlbum.id);
    const nextIndex = currentIndex < defaultMockAlbums.length - 1 ? currentIndex + 1 : 0;
    handleSelectAlbum(defaultMockAlbums[nextIndex]);
  };

  // When clicking a tab on the dock, update the third column to that panel
  const handleSelectDockTab = (tab: DockTabId) => {
    setActiveTab(tab);
    if (tab === "queue" || tab === "theme-studio" || tab === "lyrics") {
      setColumnPanel(2, tab);
    }
  };

  // Derive active playback values
  const activeIsPlaying = model.playback.status === "playing" || isPlaying;
  const activePositionMs = model.playback.positionMs || positionMs;
  const activeDurationMs = model.playback.durationMs || selectedAlbum.durationMs || 115000;
  const currentVolume = model.playback.volume ?? 0.75;

  return (
    <div className="ahoy-app-container">
      {/* Window Title Bar */}
      <WindowTitleBar title="Ahoy Player" />

      {/* Main Workspace: 3 Customizable Columns + Dock */}
      <div className="ahoy-workspace-body">
        <div className="ahoy-workspace-columns">
          {columns.map((panelId, colIndex) => {
            const typedColIndex = colIndex as 0 | 1 | 2;
            const isTarget = dragOverCol === typedColIndex;
            return (
              <section
                key={colIndex}
                className={`ahoy-workspace-column ahoy-workspace-column--${panelId} ${isTarget ? "is-drag-target" : ""}`}
                aria-label={`Workspace Column ${colIndex + 1}`}
              >
                <ColumnHeader
                  columnIndex={typedColIndex}
                  currentPanel={panelId}
                  onChangePanel={(newPanel) => {
                    setColumnPanel(typedColIndex, newPanel);
                    if (newPanel === "queue" || newPanel === "theme-studio" || newPanel === "lyrics") {
                      setActiveTab(newPanel);
                    }
                  }}
                  onMoveLeft={() => {
                    if (typedColIndex > 0) {
                      swapColumns(typedColIndex, (typedColIndex - 1) as 0 | 1 | 2);
                    }
                  }}
                  onMoveRight={() => {
                    if (typedColIndex < 2) {
                      swapColumns(typedColIndex, (typedColIndex + 1) as 0 | 1 | 2);
                    }
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", String(typedColIndex));
                    setDraggingCol(typedColIndex);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverCol !== typedColIndex) {
                      setDragOverCol(typedColIndex);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverCol === typedColIndex) {
                      setDragOverCol(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingCol !== null && draggingCol !== typedColIndex) {
                      swapColumns(draggingCol as 0 | 1 | 2, typedColIndex);
                    }
                    setDraggingCol(null);
                    setDragOverCol(null);
                  }}
                  isDragOver={isTarget}
                />
                <div className="ahoy-column-content">
                  <ColumnPanelRenderer
                    panelId={panelId}
                    activeNav={activeNav}
                    onSelectNav={setActiveNav}
                    selectedAlbum={selectedAlbum}
                    onSelectAlbum={handleSelectAlbum}
                    nauticalThemes={nauticalThemes}
                    activeThemeId={activeThemeId}
                    onSelectTheme={applyNauticalTheme}
                    colorVariables={colorVariables}
                    onChangeColor={updateColorVariable}
                    isAdvanced={isAdvanced}
                    onToggleAdvanced={setIsAdvanced}
                    cssCode={customCss}
                    onChangeCss={setCustomCss}
                  />
                </div>
              </section>
            );
          })}
        </div>

        {/* Right Utility Dock */}
        <UtilityDock
          activeTab={columns[2] === "queue" ? "queue" : columns[2] === "theme-studio" ? "theme-studio" : columns[2] === "lyrics" ? "lyrics" : activeTab}
          onSelectTab={handleSelectDockTab}
        />
      </div>

      {/* Bottom Player Bar */}
      <BottomPlayerBar
        currentTrack={selectedAlbum}
        isPlaying={activeIsPlaying}
        positionMs={activePositionMs}
        durationMs={activeDurationMs}
        volume={currentVolume}
        onTogglePlay={handleTogglePlay}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onSeek={setPositionMs}
        onChangeVolume={(vol) => model.setVolume(vol)}
        onToggleQueue={() => setColumnPanel(2, "queue")}
        statusText="READY."
        subStatusText="QUEUE NATIVE RUST STATE. LOCAL FILES NEVER UPLOADED."
      />
    </div>
  );
}
