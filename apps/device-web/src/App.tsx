import React, { useState, useEffect } from "react";
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
import { useSleepTimer } from "./hooks/useSleepTimer";
import { usePlaylists } from "./hooks/usePlaylists";
import { useAhoyInput } from "@ahoy/player-ui-dial";
import type { NavItemId, AlbumCardData, DockTabId } from "./types/player-ui";
import type { RepeatMode } from "./components/player/TransportControls";

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

  // Sovereign Playlists & Favorites Hook
  const {
    playlists,
    favorites,
    createPlaylist,
    deletePlaylist,
    toggleTrackInPlaylist,
    toggleFavorite,
    isFavorite,
  } = usePlaylists();

  // Sovereign AHOY ID & Entitlements state
  const [ahoyId, setAhoyId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qId = params.get("ahoy_id");
      if (qId) {
        localStorage.setItem("ahoy_id", qId);
        return qId;
      }
      return localStorage.getItem("ahoy_id");
    }
    return null;
  });

  const [entitledAlbums, setEntitledAlbums] = useState<AlbumCardData[]>([]);

  // Sync entitlements from AHOY Market
  useEffect(() => {
    if (!ahoyId) return;

    const marketHost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "http://127.0.0.1:3020"
        : "https://market.ahoy.ooo";

    fetch(`${marketHost}/api/entitlements?ahoy_id=${encodeURIComponent(ahoyId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.tracks) && data.tracks.length > 0) {
          const newCards: AlbumCardData[] = data.tracks.map((t: any) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            album: "AHOY Market Purchase",
            coverType: "vinyl-beige" as const,
            displayLabel: `AHOY Sovereign Unlock — ${t.artist} - ${t.title}`,
            durationMs: (t.duration_seconds || 180) * 1000,
            audioUrl: t.direct_audio_url || t.stream_url,
          }));
          setEntitledAlbums(newCards);
        }
      })
      .catch((err) => console.error("Failed to sync AHOY Market entitlements:", err));
  }, [ahoyId]);

  const allAlbums: AlbumCardData[] = [...entitledAlbums, ...defaultMockAlbums];

  // Navigation state
  const [activeNav, setActiveNav] = useState<NavItemId>("artists");

  // 3-Column Customizable Workspace
  const { columns, setColumnPanel, swapColumns } = useWorkspaceColumns();
  const [draggingCol, setDraggingCol] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);

  // Dynamic filter based on left sidebar navigation
  const activePlaylist = playlists.find(
    (p) =>
      p.id === activeNav ||
      (activeNav === "top-playlists-1" && p.id === playlists[0]?.id) ||
      (activeNav === "top-playlists-2" && p.id === playlists[1]?.id)
  );

  const displayedAlbums: AlbumCardData[] = React.useMemo(() => {
    if (activeNav === "recently-added-star") {
      return allAlbums.filter((a) => favorites.includes(a.id));
    }
    if (activeNav === "recently-added-clock") {
      return [...allAlbums].reverse();
    }
    if (activePlaylist) {
      return allAlbums.filter((a) => activePlaylist.trackIds.includes(a.id));
    }
    return allAlbums;
  }, [allAlbums, activeNav, favorites, activePlaylist]);

  // Track selection state
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumCardData>(allAlbums[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);

  // Shuffle & Repeat transport state
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");

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

    if (card.audioUrl) {
      playbackAdapter.load({
        id: card.id,
        title: card.title,
        artistId: card.artist,
        artistName: card.artist,
        albumId: card.album,
        albumTitle: card.album,
        importedAt: new Date().toISOString(),
        source: {
          kind: "local-file",
          locator: card.audioUrl,
          filename: card.title,
          byteSize: 0,
          duplicateKey: card.id,
        },
        displayMetadata: {
          policy: "embedded-tag",
        },
        durationMs: card.durationMs || 180000,
      });
      playbackAdapter.play();
      setIsPlaying(true);
      return;
    }

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
    const pool = displayedAlbums.length > 0 ? displayedAlbums : allAlbums;
    const currentIndex = pool.findIndex((a) => a.id === selectedAlbum.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : pool.length - 1;
    handleSelectAlbum(pool[prevIndex]);
  };

  const handleNext = () => {
    const pool = displayedAlbums.length > 0 ? displayedAlbums : allAlbums;
    if (repeatMode === "one") {
      handleSelectAlbum(selectedAlbum);
      return;
    }
    if (isShuffle && pool.length > 1) {
      let nextIdx = Math.floor(Math.random() * pool.length);
      const currIdx = pool.findIndex((a) => a.id === selectedAlbum.id);
      if (nextIdx === currIdx) {
        nextIdx = (nextIdx + 1) % pool.length;
      }
      handleSelectAlbum(pool[nextIdx]);
      return;
    }
    const currentIndex = pool.findIndex((a) => a.id === selectedAlbum.id);
    const nextIndex = currentIndex < pool.length - 1 ? currentIndex + 1 : 0;
    handleSelectAlbum(pool[nextIndex]);
  };

  // Dynamic Navigation click handler
  const handleSelectNav = (id: NavItemId) => {
    setActiveNav(id);
    if (id === "transitions") {
      setColumnPanel(2, "visualizer");
    } else if (id === "audio") {
      setColumnPanel(2, "dial");
    } else {
      // Ensure column 1 displays grid
      if (columns[1] !== "grid") {
        setColumnPanel(1, "grid");
      }
    }
  };

  const handleCreatePlaylist = (name: string) => {
    const newPl = createPlaylist(name);
    setActiveNav(newPl.id);
    if (columns[1] !== "grid") {
      setColumnPanel(1, "grid");
    }
  };

  const handleDeletePlaylist = (id: string) => {
    deletePlaylist(id);
    if (activeNav === id) {
      setActiveNav("playlists");
    }
  };

  // Connect tactile Hardware Dial / Keyboard / Gamepad input bus
  useAhoyInput((action) => {
    switch (action.type) {
      case "play":
      case "select":
        handleTogglePlay();
        break;
      case "next":
        handleNext();
        break;
      case "back":
        handlePrevious();
        break;
      case "turn":
        setPositionMs((prev) => {
          const delta = action.direction * 5000;
          return Math.max(0, Math.min(activeDurationMs, prev + delta));
        });
        break;
      case "menu":
        // Toggle the third column to visualizer or dial
        setColumnPanel(2, columns[2] === "visualizer" ? "dial" : "visualizer");
        break;
    }
  });

  // When clicking a tab on the dock, update the third column to that panel
  const handleSelectDockTab = (tab: DockTabId) => {
    setActiveTab(tab);
    if (
      tab === "queue" ||
      tab === "theme-studio" ||
      tab === "lyrics" ||
      tab === "visualizer" ||
      tab === "dial"
    ) {
      setColumnPanel(2, tab);
    }
  };

  // Derive active playback values
  const activeIsPlaying = model.playback.status === "playing" || isPlaying;
  const activePositionMs = model.playback.positionMs || positionMs;
  const activeDurationMs = model.playback.durationMs || selectedAlbum.durationMs || 115000;
  const currentVolume = model.playback.volume ?? 0.75;

  // Playback speed state
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  const handleChangePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    playbackAdapter.setPlaybackRate(rate);
  };

  // Sleep Timer (Night Watch)
  const sleepTimer = useSleepTimer({
    isPlaying: activeIsPlaying,
    onPause: () => {
      if (model.playback.status === "playing") {
        model.togglePlayback();
      } else {
        setIsPlaying(false);
      }
    },
    currentVolume,
    onSetVolume: (vol) => model.setVolume(vol),
    positionMs: activePositionMs,
    durationMs: activeDurationMs,
  });

  return (
    <div className="ahoy-app-container">
      {/* Window Title Bar */}
      <WindowTitleBar
        title={
          ahoyId
            ? `Ahoy Player — ⚓ AHOY ID: ${ahoyId} (${entitledAlbums.length} unlocked)`
            : "Ahoy Player"
        }
      />

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
                    onSelectNav={handleSelectNav}
                    selectedAlbum={selectedAlbum}
                    onSelectAlbum={handleSelectAlbum}
                    onScanMp3s={() => void model.importFiles()}
                    isScanning={model.isImporting}
                    albums={displayedAlbums}
                    nauticalThemes={nauticalThemes}
                    activeThemeId={activeThemeId}
                    onSelectTheme={applyNauticalTheme}
                    colorVariables={colorVariables}
                    onChangeColor={updateColorVariable}
                    isAdvanced={isAdvanced}
                    onToggleAdvanced={setIsAdvanced}
                    cssCode={customCss}
                    onChangeCss={setCustomCss}
                    isPlaying={activeIsPlaying}
                    onTogglePlay={handleTogglePlay}
                    onNextTrack={handleNext}
                    onPreviousTrack={handlePrevious}
                    onSeek={(ratio) => setPositionMs(Math.round(ratio * activeDurationMs))}
                    positionMs={activePositionMs}
                    durationMs={activeDurationMs}
                    volume={currentVolume}
                    playlists={playlists}
                    onCreatePlaylist={handleCreatePlaylist}
                    onDeletePlaylist={handleDeletePlaylist}
                    favoritesCount={favorites.length}
                    totalTracksCount={allAlbums.length}
                    artistsCount={new Set(allAlbums.map((a) => a.artist.split(" / ")[0].trim())).size}
                    albumsCount={new Set(allAlbums.map((a) => a.album)).size}
                    playlistName={activePlaylist?.name}
                    isFavorite={isFavorite}
                    onToggleFavorite={toggleFavorite}
                  />
                </div>
              </section>
            );
          })}
        </div>

        {/* Right Utility Dock */}
        <UtilityDock
          activeTab={
            columns[2] === "queue"
              ? "queue"
              : columns[2] === "theme-studio"
              ? "theme-studio"
              : columns[2] === "lyrics"
              ? "lyrics"
              : columns[2] === "visualizer"
              ? "visualizer"
              : columns[2] === "dial"
              ? "dial"
              : activeTab
          }
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
        onToggleVisualizer={() => setColumnPanel(2, "visualizer")}
        onToggleDial={() => setColumnPanel(2, "dial")}
        playbackRate={playbackRate}
        onChangePlaybackRate={handleChangePlaybackRate}
        selectedSleepOption={sleepTimer.selectedOption}
        formattedSleepRemaining={sleepTimer.formattedRemaining}
        onSetSleepTimer={sleepTimer.setTimer}
        isShuffle={isShuffle}
        onToggleShuffle={() => setIsShuffle((prev) => !prev)}
        repeatMode={repeatMode}
        onCycleRepeat={() =>
          setRepeatMode((prev) => (prev === "off" ? "all" : prev === "all" ? "one" : "off"))
        }
        statusText="READY."
        subStatusText="QUEUE NATIVE RUST STATE. LOCAL FILES NEVER UPLOADED."
      />
    </div>
  );
}
