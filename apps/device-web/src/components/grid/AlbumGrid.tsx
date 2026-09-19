import React, { useState } from "react";
import { AlbumCard } from "./AlbumCard";
import { CoverFlowView } from "./CoverFlowView";
import { TableView } from "./TableView";
import { ScanIcon, CoverFlowIcon, GridIcon, ListTableIcon } from "../common/Icons";
import type { AlbumCardData } from "../../types/player-ui";

export type CollectionViewMode = "coverflow" | "grid" | "table";
export type GridDensity = "compact" | "standard" | "large";

export const defaultMockAlbums: AlbumCardData[] = [
  {
    id: "track-1",
    title: "Ooo",
    artist: "Karen Dalton",
    album: "In My Own Time",
    coverType: "vinyl-beige",
    displayLabel: "Placeholder Cover - Karen Dalton - Ooo",
    durationMs: 115000,
  },
  {
    id: "track-2",
    title: "Sea of Dreams",
    artist: "Oberhofer",
    album: "Time Capsules II",
    coverType: "chart-teal",
    displayLabel: "Placeholder Cover - Oberhofer - Sea of Dreams",
    durationMs: 198000,
  },
  {
    id: "track-3",
    title: "The Neon Skyline",
    artist: "Oberhofer",
    album: "Smothered",
    coverType: "neon-mountain",
    displayLabel: "Placeholder Cover - Oberhofer - The Neon Skyline",
    durationMs: 214000,
  },
  {
    id: "track-4",
    title: "Ooo",
    artist: "Karen Dalton",
    album: "1966 Archives",
    coverType: "vinyl-pink",
    displayLabel: "Placeholder Cover - Karen Dalton - Ooo",
    durationMs: 130000,
  },
  {
    id: "track-5",
    title: "The Magician",
    artist: "Andy Shauf",
    album: "The Party",
    coverType: "waveform-teal",
    displayLabel: "Placeholder Cover - Andy Shauf",
    durationMs: 231000,
  },
  {
    id: "track-6",
    title: "Little Little Dark Age",
    artist: "MGMT / Remix",
    album: "Little Dark Age",
    coverType: "minimal-mint",
    displayLabel: "Placeholder Cover - Little Little Dark Age",
    durationMs: 184000,
  },
  {
    id: "track-7",
    title: "Together / Never",
    artist: "Oberhofer",
    album: "Chronovision",
    coverType: "vinyl-slate",
    displayLabel: "Placeholder Cover - Oberhofer",
    durationMs: 205000,
  },
  {
    id: "track-8",
    title: "Little Dark Age",
    artist: "MGMT",
    album: "Little Dark Age",
    coverType: "vinyl-plum",
    displayLabel: "Placeholder Cover - Little Dark Age",
    durationMs: 299000,
  },
  {
    id: "track-9",
    title: "Always Forever",
    artist: "Cults",
    album: "Static",
    coverType: "target-black",
    displayLabel: "Placeholder Cover - Cults",
    durationMs: 223000,
  },
];

type AlbumGridProps = {
  albums?: AlbumCardData[];
  selectedId?: string;
  onSelectAlbum: (card: AlbumCardData) => void;
  onScanMp3s?: () => void;
  isScanning?: boolean;
};

export const AlbumGrid: React.FC<AlbumGridProps> = ({
  albums = defaultMockAlbums,
  selectedId,
  onSelectAlbum,
  onScanMp3s,
  isScanning = false,
}) => {
  const [viewMode, setViewMode] = useState<CollectionViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ahoy:collection-view-mode");
      if (saved === "coverflow" || saved === "grid" || saved === "table") {
        return saved;
      }
    }
    return "coverflow";
  });

  const [density, setDensity] = useState<GridDensity>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ahoy:grid-density");
      if (saved === "compact" || saved === "standard" || saved === "large") {
        return saved;
      }
    }
    return "standard";
  });

  const handleSetViewMode = (mode: CollectionViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("ahoy:collection-view-mode", mode);
    }
  };

  const handleSetDensity = (d: GridDensity) => {
    setDensity(d);
    if (typeof window !== "undefined") {
      localStorage.setItem("ahoy:grid-density", d);
    }
  };

  return (
    <main className="ahoy-center-content">
      <div className="ahoy-grid-header">
        <div className="ahoy-grid-title-wrap">
          <span className="ahoy-grid-eyebrow">YOUR COLLECTION</span>
          <h2 className="ahoy-grid-heading">Local Music Library</h2>
        </div>

        <div className="ahoy-grid-header-actions">
          {/* View Mode Switcher */}
          <div className="ahoy-view-switcher-group" role="tablist" aria-label="Collection view switcher">
            <button
              type="button"
              className={`ahoy-view-switcher-btn ${viewMode === "coverflow" ? "is-active" : ""}`}
              onClick={() => handleSetViewMode("coverflow")}
              title="3D Vinyl Cover Flow Crate"
              aria-label="3D Cover Flow View"
            >
              <CoverFlowIcon size={15} />
              <span>Cover Flow</span>
            </button>

            <button
              type="button"
              className={`ahoy-view-switcher-btn ${viewMode === "grid" ? "is-active" : ""}`}
              onClick={() => handleSetViewMode("grid")}
              title="Album Art Grid"
              aria-label="Grid View"
            >
              <GridIcon size={15} />
              <span>Grid</span>
            </button>

            <button
              type="button"
              className={`ahoy-view-switcher-btn ${viewMode === "table" ? "is-active" : ""}`}
              onClick={() => handleSetViewMode("table")}
              title="High-density Tracklist Table"
              aria-label="Table View"
            >
              <ListTableIcon size={15} />
              <span>Table</span>
            </button>
          </div>

          {/* Density controls when in grid mode */}
          {viewMode === "grid" && (
            <div className="ahoy-density-group" aria-label="Grid density">
              <button
                type="button"
                className={`ahoy-density-btn ${density === "compact" ? "is-active" : ""}`}
                onClick={() => handleSetDensity("compact")}
                title="Compact 4-column grid"
              >
                4x4
              </button>
              <button
                type="button"
                className={`ahoy-density-btn ${density === "standard" ? "is-active" : ""}`}
                onClick={() => handleSetDensity("standard")}
                title="Standard 3-column grid"
              >
                3x3
              </button>
              <button
                type="button"
                className={`ahoy-density-btn ${density === "large" ? "is-active" : ""}`}
                onClick={() => handleSetDensity("large")}
                title="Large 2-column grid"
              >
                2x2
              </button>
            </div>
          )}

          {/* Scan for MP3s Button */}
          <button
            type="button"
            className="ahoy-scan-mp3-btn ahoy-scan-mp3-btn--prominent"
            onClick={onScanMp3s}
            title="Scan device for local MP3 audio files"
          >
            <ScanIcon size={18} />
            <span>{isScanning ? "Scanning for MP3s…" : "Scan for MP3s"}</span>
          </button>
        </div>
      </div>

      {/* Render selected view mode */}
      {viewMode === "coverflow" && (
        <CoverFlowView
          albums={albums}
          selectedId={selectedId}
          onSelectAlbum={onSelectAlbum}
        />
      )}

      {viewMode === "table" && (
        <TableView
          albums={albums}
          selectedId={selectedId}
          onSelectAlbum={onSelectAlbum}
        />
      )}

      {viewMode === "grid" && (
        <div
          className={`ahoy-album-grid ahoy-album-grid--${density}`}
          role="region"
          aria-label="Music Collection"
        >
          {albums.map((card) => (
            <AlbumCard
              key={card.id}
              card={card}
              isSelected={card.id === selectedId}
              onSelect={onSelectAlbum}
            />
          ))}
        </div>
      )}
    </main>
  );
};
