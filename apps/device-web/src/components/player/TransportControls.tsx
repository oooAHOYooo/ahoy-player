import React from "react";
import {
  PrevTrackIcon,
  PlayIcon,
  PauseIcon,
  NextTrackIcon,
} from "../common/Icons";

type TransportControlsProps = {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

export const TransportControls: React.FC<TransportControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onPrevious,
  onNext,
}) => {
  return (
    <div className="ahoy-player-transport" aria-label="Playback controls">
      <button
        type="button"
        className="ahoy-transport-btn ahoy-transport-prev"
        onClick={onPrevious}
        aria-label="Previous track"
      >
        <PrevTrackIcon size={16} />
      </button>
      <button
        type="button"
        className="ahoy-transport-btn ahoy-transport-play-circle"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
      </button>
      <button
        type="button"
        className="ahoy-transport-btn ahoy-transport-next"
        onClick={onNext}
        aria-label="Next track"
      >
        <NextTrackIcon size={16} />
      </button>
    </div>
  );
};
