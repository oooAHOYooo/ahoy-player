import React, { useState, useEffect, useRef } from "react";
import { CoverArtRenderer } from "./CoverArtRenderer";
import { ArrowLeftIcon, ArrowRightIcon, StarIcon } from "../common/Icons";
import type { AlbumCardData } from "../../types/player-ui";

type CoverFlowViewProps = {
  albums: AlbumCardData[];
  selectedId?: string;
  onSelectAlbum: (card: AlbumCardData) => void;
  isFavorite?: (trackId: string) => boolean;
  onToggleFavorite?: (trackId: string) => void;
};

export const CoverFlowView: React.FC<CoverFlowViewProps> = ({
  albums,
  selectedId,
  onSelectAlbum,
  isFavorite,
  onToggleFavorite,
}) => {
  const initialIndex = Math.max(
    0,
    albums.findIndex((a) => a.id === selectedId)
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Sync if selectedId changes externally
  useEffect(() => {
    if (selectedId) {
      const idx = albums.findIndex((a) => a.id === selectedId);
      if (idx !== -1 && idx !== activeIndex) {
        setActiveIndex(idx);
      }
    }
  }, [selectedId, albums]);

  const activeAlbum = albums[activeIndex] || albums[0];

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : albums.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < albums.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      handlePrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      handleNext();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (activeAlbum) onSelectAlbum(activeAlbum);
    }
  };

  // Mouse wheel flip with debounce
  const wheelLockRef = useRef(false);
  const handleWheel = (e: React.WheelEvent) => {
    if (wheelLockRef.current) return;
    if (Math.abs(e.deltaX) > 20 || Math.abs(e.deltaY) > 20) {
      wheelLockRef.current = true;
      if (e.deltaX > 0 || e.deltaY > 0) {
        handleNext();
      } else {
        handlePrev();
      }
      setTimeout(() => {
        wheelLockRef.current = false;
      }, 160);
    }
  };

  return (
    <div
      className="ahoy-coverflow-container"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      role="region"
      aria-label="3D Vinyl Cover Flow Crate"
    >
      <div className="ahoy-coverflow-stage" ref={stageRef}>
        {/* Navigation Arrow Left */}
        <button
          type="button"
          className="ahoy-coverflow-arrow ahoy-coverflow-arrow--left"
          onClick={handlePrev}
          title="Previous album (or Left Arrow)"
          aria-label="Previous album"
        >
          <ArrowLeftIcon size={20} />
        </button>

        {/* 3D Cards Track */}
        <div className="ahoy-coverflow-track">
          {albums.map((album, index) => {
            const offset = index - activeIndex;
            const isCenter = offset === 0;

            // Compute 3D translation & rotation
            let transform = "";
            let zIndex = 50 - Math.abs(offset);
            let opacity = 1;

            if (isCenter) {
              transform = `translate3d(0, 0, 160px) rotateY(0deg) scale(1.05)`;
              zIndex = 100;
              opacity = 1;
            } else if (offset < 0) {
              const xPos = offset * 80 - 150;
              const zPos = -Math.abs(offset) * 45;
              transform = `translate3d(${xPos}px, 0, ${zPos}px) rotateY(52deg)`;
              opacity = Math.max(0.2, 1 - Math.abs(offset) * 0.16);
            } else {
              const xPos = offset * 80 + 150;
              const zPos = -Math.abs(offset) * 45;
              transform = `translate3d(${xPos}px, 0, ${zPos}px) rotateY(-52deg)`;
              opacity = Math.max(0.2, 1 - Math.abs(offset) * 0.16);
            }

            return (
              <div
                key={album.id}
                className={`ahoy-coverflow-card ${isCenter ? "is-center" : ""} ${album.id === selectedId ? "is-selected" : ""}`}
                style={{
                  transform,
                  zIndex,
                  opacity,
                }}
                onClick={() => {
                  if (isCenter) {
                    onSelectAlbum(album);
                  } else {
                    setActiveIndex(index);
                  }
                }}
                title={isCenter ? `Click to play ${album.title}` : `Click to bring ${album.title} to center`}
              >
                <div className="ahoy-coverflow-card-inner">
                  <CoverArtRenderer coverType={album.coverType} />
                  {isCenter && (
                    <div className="ahoy-coverflow-play-pill">
                      <span>▶ PLAY ALBUM</span>
                    </div>
                  )}
                </div>

                {/* Mirrored floor reflection */}
                <div className="ahoy-coverflow-reflection" aria-hidden="true">
                  <CoverArtRenderer coverType={album.coverType} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Arrow Right */}
        <button
          type="button"
          className="ahoy-coverflow-arrow ahoy-coverflow-arrow--right"
          onClick={handleNext}
          title="Next album (or Right Arrow)"
          aria-label="Next album"
        >
          <ArrowRightIcon size={20} />
        </button>
      </div>

      {/* Active Record Information Display */}
      {activeAlbum && (
        <div className="ahoy-coverflow-info">
          <div className="ahoy-coverflow-info-eyebrow">
            CRATE ITEM {activeIndex + 1} OF {albums.length}
          </div>
          <h3 className="ahoy-coverflow-info-title">{activeAlbum.title}</h3>
          <p className="ahoy-coverflow-info-artist">
            {activeAlbum.artist} — <span className="ahoy-coverflow-info-album">{activeAlbum.album}</span>
          </p>
          <div className="ahoy-coverflow-actions-row">
            <button
              type="button"
              className="ahoy-coverflow-center-play-btn"
              onClick={() => onSelectAlbum(activeAlbum)}
            >
              ▶ Listen to this record
            </button>
            {onToggleFavorite && (
              <button
                type="button"
                className={`ahoy-coverflow-fav-btn ${isFavorite?.(activeAlbum.id) ? "is-favorited" : ""}`}
                onClick={() => onToggleFavorite(activeAlbum.id)}
                title={isFavorite?.(activeAlbum.id) ? "Remove from Favorites" : "Add to Favorites"}
                aria-label={isFavorite?.(activeAlbum.id) ? "Remove from Favorites" : "Add to Favorites"}
              >
                <StarIcon size={18} filled={isFavorite?.(activeAlbum.id)} color="var(--ahoy-accent-gold, #f59e0b)" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
