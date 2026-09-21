import React from "react";
import { CoverArtRenderer } from "./CoverArtRenderer";
import { StarIcon } from "../common/Icons";
import type { AlbumCardData } from "../../types/player-ui";

type TableViewProps = {
  albums: AlbumCardData[];
  selectedId?: string;
  onSelectAlbum: (card: AlbumCardData) => void;
  isFavorite?: (trackId: string) => boolean;
  onToggleFavorite?: (trackId: string) => void;
};

function formatDuration(ms?: number): string {
  if (!ms) return "3:15";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export const TableView: React.FC<TableViewProps> = ({
  albums,
  selectedId,
  onSelectAlbum,
  isFavorite,
  onToggleFavorite,
}) => {
  return (
    <div className="ahoy-table-view-container" role="region" aria-label="Library Table">
      <table className="ahoy-track-table">
        <thead>
          <tr>
            <th className="ahoy-col-th ahoy-th-num">#</th>
            <th className="ahoy-col-th ahoy-th-fav">★</th>
            <th className="ahoy-col-th ahoy-th-title">TITLE</th>
            <th className="ahoy-col-th ahoy-th-artist">ARTIST</th>
            <th className="ahoy-col-th ahoy-th-album">ALBUM</th>
            <th className="ahoy-col-th ahoy-th-duration">TIME</th>
            <th className="ahoy-col-th ahoy-th-action">ACTION</th>
          </tr>
        </thead>
        <tbody>
          {albums.map((album, idx) => {
            const isSelected = album.id === selectedId;
            const fav = isFavorite ? isFavorite(album.id) : false;
            return (
              <tr
                key={album.id}
                className={`ahoy-track-row ${isSelected ? "is-selected" : ""}`}
                onClick={() => onSelectAlbum(album)}
                title={`Play ${album.title} - ${album.artist}`}
              >
                <td className="ahoy-td-num">
                  {isSelected ? (
                    <span className="ahoy-playing-indicator" title="Selected">▶</span>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </td>
                <td className="ahoy-td-fav">
                  {onToggleFavorite && (
                    <button
                      type="button"
                      className={`ahoy-table-fav-btn ${fav ? "is-favorited" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(album.id);
                      }}
                      title={fav ? "Remove from Favorites" : "Add to Favorites"}
                      aria-label={fav ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      <StarIcon size={14} filled={fav} />
                    </button>
                  )}
                </td>
                <td className="ahoy-td-title">
                  <div className="ahoy-table-thumb-wrap">
                    <CoverArtRenderer coverType={album.coverType} />
                  </div>
                  <span className="ahoy-table-track-name">{album.title}</span>
                </td>
                <td className="ahoy-td-artist">{album.artist}</td>
                <td className="ahoy-td-album">{album.album}</td>
                <td className="ahoy-td-duration">{formatDuration(album.durationMs)}</td>
                <td className="ahoy-td-action">
                  <button
                    type="button"
                    className="ahoy-table-play-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAlbum(album);
                    }}
                    aria-label={`Play ${album.title}`}
                  >
                    ▶
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
