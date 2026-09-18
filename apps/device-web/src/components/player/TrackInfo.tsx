import React from "react";
import { CoverArtRenderer } from "../grid/CoverArtRenderer";
import type { AlbumCardData } from "../../types/player-ui";

type TrackInfoProps = {
  title?: string;
  artist?: string;
  coverType?: AlbumCardData["coverType"];
};

export const TrackInfo: React.FC<TrackInfoProps> = ({
  title = "Ooo",
  artist = "Karen Dalton",
  coverType = "vinyl-beige",
}) => {
  return (
    <div className="ahoy-player-track-info">
      <div className="ahoy-player-thumbnail">
        <CoverArtRenderer coverType={coverType} className="ahoy-player-art-thumb" />
      </div>
      <div className="ahoy-player-track-meta">
        <strong className="ahoy-player-title">{title}</strong>
        <span className="ahoy-player-artist">{artist}</span>
      </div>
    </div>
  );
};
