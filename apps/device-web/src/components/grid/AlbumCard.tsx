import React from "react";
import { CoverArtRenderer } from "./CoverArtRenderer";
import type { AlbumCardData } from "../../types/player-ui";

type AlbumCardProps = {
  card: AlbumCardData;
  isSelected?: boolean;
  onSelect: (card: AlbumCardData) => void;
};

export const AlbumCard: React.FC<AlbumCardProps> = ({
  card,
  isSelected = false,
  onSelect,
}) => {
  const label =
    card.displayLabel ??
    `Placeholder Cover - ${card.artist}${card.title ? ` - ${card.title}` : ""}`;

  return (
    <div
      className={`ahoy-album-card ${isSelected ? "is-selected" : ""}`}
      onClick={() => onSelect(card)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(card);
        }
      }}
      aria-label={`Play ${card.title} by ${card.artist}`}
    >
      <div className="ahoy-album-card-art-wrap">
        <CoverArtRenderer coverType={card.coverType} />
      </div>
      <p className="ahoy-album-card-label" title={label}>
        {label}
      </p>
    </div>
  );
};
