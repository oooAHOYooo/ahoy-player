import React from "react";
import { PlaybackSpeedControl } from "./PlaybackSpeedControl";

type TimelineScrubberProps = {
  currentMs: number;
  totalMs: number;
  onSeek: (ms: number) => void;
  playbackRate?: number;
  onChangePlaybackRate?: (rate: number) => void;
};

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  currentMs,
  totalMs,
  onSeek,
  playbackRate = 1.0,
  onChangePlaybackRate = () => {},
}) => {
  const progressPercent = totalMs > 0 ? Math.min(100, (currentMs / totalMs) * 100) : 0;

  return (
    <div className="ahoy-player-scrubber-row">
      <span className="ahoy-player-time ahoy-player-time--current">
        {formatMs(currentMs)}
      </span>
      <div className="ahoy-player-slider-wrap">
        <input
          type="range"
          className="ahoy-player-range-input"
          min="0"
          max={Math.max(1, totalMs)}
          value={Math.min(currentMs, totalMs)}
          onChange={(e) => onSeek(Number(e.target.value))}
          style={{ "--range-progress": `${progressPercent}%` } as React.CSSProperties}
          aria-label="Seek track position"
        />
      </div>
      <span className="ahoy-player-time ahoy-player-time--total">
        {formatMs(totalMs)}
      </span>
      <PlaybackSpeedControl
        currentSpeed={playbackRate}
        onChangeSpeed={onChangePlaybackRate}
      />
    </div>
  );
};
