import React from "react";
import {
  PrevTrackIcon,
  PlayIcon,
  PauseIcon,
  NextTrackIcon,
  ShuffleIcon,
  RepeatIcon,
} from "../common/Icons";

export type RepeatMode = "off" | "all" | "one";

type TransportControlsProps = {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  isShuffle?: boolean;
  onToggleShuffle?: () => void;
  repeatMode?: RepeatMode;
  onCycleRepeat?: () => void;
};

export const TransportControls: React.FC<TransportControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onPrevious,
  onNext,
  isShuffle = false,
  onToggleShuffle,
  repeatMode = "off",
  onCycleRepeat,
}) => {
  return (
    <div className="ahoy-player-transport" aria-label="Playback controls">
      {/* Shuffle button */}
      {onToggleShuffle && (
        <button
          type="button"
          className={`ahoy-transport-btn ahoy-transport-shuffle ${isShuffle ? "is-active" : ""}`}
          onClick={onToggleShuffle}
          title={isShuffle ? "Shuffle On" : "Shuffle Off"}
          aria-label={isShuffle ? "Shuffle On" : "Shuffle Off"}
        >
          <ShuffleIcon size={14} color={isShuffle ? "var(--ahoy-accent-teal, #2dd4bf)" : "currentColor"} />
        </button>
      )}

      {/* Previous track */}
      <button
        type="button"
        className="ahoy-transport-btn ahoy-transport-prev"
        onClick={onPrevious}
        aria-label="Previous track"
      >
        <PrevTrackIcon size={16} />
      </button>

      {/* Play / Pause */}
      <button
        type="button"
        className="ahoy-transport-btn ahoy-transport-play-circle"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
      </button>

      {/* Next track */}
      <button
        type="button"
        className="ahoy-transport-btn ahoy-transport-next"
        onClick={onNext}
        aria-label="Next track"
      >
        <NextTrackIcon size={16} />
      </button>

      {/* Repeat button */}
      {onCycleRepeat && (
        <div className="ahoy-transport-repeat-wrap">
          <button
            type="button"
            className={`ahoy-transport-btn ahoy-transport-repeat ${repeatMode !== "off" ? "is-active" : ""}`}
            onClick={onCycleRepeat}
            title={
              repeatMode === "off"
                ? "Repeat: Off"
                : repeatMode === "all"
                ? "Repeat: All"
                : "Repeat: One Track"
            }
            aria-label={`Repeat mode: ${repeatMode}`}
          >
            <RepeatIcon
              size={14}
              color={repeatMode !== "off" ? "var(--ahoy-accent-teal, #2dd4bf)" : "currentColor"}
            />
            {repeatMode === "one" && <span className="ahoy-transport-repeat-badge">1</span>}
          </button>
        </div>
      )}
    </div>
  );
};
