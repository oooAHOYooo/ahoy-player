import React from "react";
import { AlbumCard } from "./AlbumCard";
import { ScanIcon } from "../common/Icons";
import type { AlbumCardData } from "../../types/player-ui";

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
  return (
    <main className="ahoy-center-content">
      <div className="ahoy-grid-header">
        <div className="ahoy-grid-title-wrap">
          <span className="ahoy-grid-eyebrow">YOUR COLLECTION</span>
          <h2 className="ahoy-grid-heading">Local Music Library</h2>
        </div>
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

      <div className="ahoy-album-grid" role="region" aria-label="Music Collection">
        {albums.map((card) => (
          <AlbumCard
            key={card.id}
            card={card}
            isSelected={card.id === selectedId}
            onSelect={onSelectAlbum}
          />
        ))}
      </div>
    </main>
  );
};
