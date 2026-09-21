import React, { useState, useEffect, useRef, useMemo } from "react";
import { AlbumCard } from "./AlbumCard";
import { CoverFlowView } from "./CoverFlowView";
import { TableView } from "./TableView";
import {
  ScanIcon,
  CoverFlowIcon,
  GridIcon,
  ListTableIcon,
  SearchIcon,
  StarIcon,
  LogoutIcon,
} from "../common/Icons";
import type { AlbumCardData, NavItemId } from "../../types/player-ui";

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
  activeNav?: NavItemId;
  playlistName?: string;
  isFavorite?: (trackId: string) => boolean;
  onToggleFavorite?: (trackId: string) => void;
};

export const AlbumGrid: React.FC<AlbumGridProps> = ({
  albums = defaultMockAlbums,
  selectedId,
  onSelectAlbum,
  onScanMp3s,
  isScanning = false,
  activeNav = "artists",
  playlistName,
  isFavorite,
  onToggleFavorite,
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

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArtistFilter, setSelectedArtistFilter] = useState("all");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Auto switch to cover flow when clicking 'albums-box'
  useEffect(() => {
    if (activeNav === "albums-box") {
      setViewMode("coverflow");
    }
  }, [activeNav]);

  // Global hotkey '/' to focus search, and 'Escape' to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.key === "/" &&
        target.tagName !== "INPUT" &&
        target.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // Distinct artists list for pill filter
  const uniqueArtists = useMemo(() => {
    const set = new Set<string>();
    albums.forEach((a) => {
      // Clean artist names (e.g. "MGMT / Remix" -> split or whole)
      set.add(a.artist.split(" / ")[0].trim());
    });
    return Array.from(set);
  }, [albums]);

  // Filtered tracks based on search query & artist pills
  const filteredAlbums = useMemo(() => {
    return albums.filter((card) => {
      // 1. Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = card.title.toLowerCase().includes(q);
        const matchesArtist = card.artist.toLowerCase().includes(q);
        const matchesAlbum = card.album.toLowerCase().includes(q);
        if (!matchesTitle && !matchesArtist && !matchesAlbum) {
          return false;
        }
      }

      // 2. Artist pill filter (active when viewing artists)
      if (activeNav === "artists" && selectedArtistFilter !== "all") {
        if (!card.artist.toLowerCase().includes(selectedArtistFilter.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [albums, searchQuery, activeNav, selectedArtistFilter]);

  // Compute context title & eyebrow
  const getHeaderContext = () => {
    if (activeNav === "artists") {
      return {
        eyebrow: "ARTISTS & DISCOGRAPHIES",
        heading: "Artist Discographies",
        subtitle: `${filteredAlbums.length} tracks across ${uniqueArtists.length} artists`,
      };
    }
    if (activeNav === "albums-disc") {
      return {
        eyebrow: "ALBUMS",
        heading: "All Albums & Records",
        subtitle: `${filteredAlbums.length} tracks`,
      };
    }
    if (activeNav === "albums-box") {
      return {
        eyebrow: "VINYL CRATE",
        heading: "3D Cover Flow Crate",
        subtitle: `Browsing ${filteredAlbums.length} albums in tactile 3D space`,
      };
    }
    if (activeNav === "recently-added-clock") {
      return {
        eyebrow: "HISTORY",
        heading: "Recently Added",
        subtitle: "Tracks sorted by most recent import timestamp",
      };
    }
    if (activeNav === "recently-added-star") {
      return {
        eyebrow: "FAVORITES",
        heading: "★ Starred Favorites",
        subtitle: `${filteredAlbums.length} starred tracks saved to sovereign storage`,
      };
    }
    if (activeNav === "logout") {
      return {
        eyebrow: "SOVEREIGN DATA",
        heading: "Local Sovereign Storage",
        subtitle: "Zero cloud tracking • Web Audio Buffers • 100% Offline",
      };
    }
    if (playlistName) {
      return {
        eyebrow: "PLAYLIST",
        heading: playlistName,
        subtitle: `${filteredAlbums.length} tracks in playlist`,
      };
    }
    return {
      eyebrow: "YOUR COLLECTION",
      heading: "Local Music Library",
      subtitle: `${filteredAlbums.length} tracks loaded`,
    };
  };

  const headerInfo = getHeaderContext();

  return (
    <main className="ahoy-center-content">
      {/* Live Search Bar */}
      <div className="ahoy-grid-search-container">
        <div className="ahoy-grid-search-wrap">
          <span className="ahoy-grid-search-icon">
            <SearchIcon size={16} />
          </span>
          <input
            ref={searchInputRef}
            type="text"
            className="ahoy-grid-search-input"
            placeholder="Search tracks, artists, albums... (Press '/' to focus)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery ? (
            <button
              type="button"
              className="ahoy-search-clear-btn"
              onClick={() => setSearchQuery("")}
              title="Clear search"
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : (
            <span className="ahoy-search-kbd-hint">/</span>
          )}
        </div>
      </div>

      {/* Artist Filter Pills (active when artists navigation selected) */}
      {activeNav === "artists" && uniqueArtists.length > 0 && (
        <div className="ahoy-artist-filter-bar" role="toolbar" aria-label="Filter by artist">
          <button
            type="button"
            className={`ahoy-artist-pill ${selectedArtistFilter === "all" ? "is-active" : ""}`}
            onClick={() => setSelectedArtistFilter("all")}
          >
            All Artists ({albums.length})
          </button>
          {uniqueArtists.map((artistName) => {
            const count = albums.filter((a) =>
              a.artist.toLowerCase().includes(artistName.toLowerCase())
            ).length;
            return (
              <button
                key={artistName}
                type="button"
                className={`ahoy-artist-pill ${selectedArtistFilter === artistName ? "is-active" : ""}`}
                onClick={() => setSelectedArtistFilter(artistName)}
              >
                {artistName} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Grid Header */}
      <div className="ahoy-grid-header">
        <div className="ahoy-grid-title-wrap">
          <span className="ahoy-grid-eyebrow">{headerInfo.eyebrow}</span>
          <h2 className="ahoy-grid-heading">{headerInfo.heading}</h2>
        </div>

        <div className="ahoy-grid-header-actions">
          {/* View Mode Switcher */}
          <div
            className="ahoy-view-switcher-group"
            role="tablist"
            aria-label="Collection view switcher"
          >
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

      {/* Sovereign Storage Diagnostic Banner (if activeNav === 'logout') */}
      {activeNav === "logout" && (
        <div className="ahoy-sovereign-storage-card">
          <div className="ahoy-sovereign-header">
            <div>
              <h3 style={{ margin: "0 0 4px 0", color: "#ffffff", fontSize: "16px" }}>
                🔒 Sovereign Hardware & Browser Storage
              </h3>
              <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
                All tracks and playlists are stored directly on your physical machine. Zero cloud streaming or DRM trackers.
              </p>
            </div>
            <span className="ahoy-sovereign-badge">OFFLINE SOVEREIGN</span>
          </div>

          <div className="ahoy-sovereign-stats-grid">
            <div className="ahoy-sovereign-stat-box">
              <div className="ahoy-sovereign-stat-val">{albums.length}</div>
              <div className="ahoy-sovereign-stat-lbl">Cached Tracks</div>
            </div>
            <div className="ahoy-sovereign-stat-box">
              <div className="ahoy-sovereign-stat-val">100%</div>
              <div className="ahoy-sovereign-stat-lbl">Local Privacy</div>
            </div>
            <div className="ahoy-sovereign-stat-box">
              <div className="ahoy-sovereign-stat-val">0 ms</div>
              <div className="ahoy-sovereign-stat-lbl">Network Latency</div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredAlbums.length === 0 && (
        <div className="ahoy-empty-collection">
          <div className="ahoy-empty-icon">🎵</div>
          <h3 style={{ color: "#ffffff", margin: "0 0 6px 0" }}>
            {searchQuery ? `No tracks matching "${searchQuery}"` : "No tracks found in this view"}
          </h3>
          <p style={{ margin: 0, fontSize: "13px" }}>
            {searchQuery
              ? "Try adjusting your search terms or clearing the filter."
              : "Scan your device storage for local MP3 files to populate this collection."}
          </p>
        </div>
      )}

      {/* Render selected view mode */}
      {filteredAlbums.length > 0 && viewMode === "coverflow" && (
        <CoverFlowView
          albums={filteredAlbums}
          selectedId={selectedId}
          onSelectAlbum={onSelectAlbum}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
        />
      )}

      {filteredAlbums.length > 0 && viewMode === "table" && (
        <TableView
          albums={filteredAlbums}
          selectedId={selectedId}
          onSelectAlbum={onSelectAlbum}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
        />
      )}

      {filteredAlbums.length > 0 && viewMode === "grid" && (
        <div
          className={`ahoy-album-grid ahoy-album-grid--${density}`}
          role="region"
          aria-label="Music Collection"
        >
          {filteredAlbums.map((card) => (
            <AlbumCard
              key={card.id}
              card={card}
              isSelected={card.id === selectedId}
              onSelect={onSelectAlbum}
              isFavorite={isFavorite ? isFavorite(card.id) : false}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </main>
  );
};
