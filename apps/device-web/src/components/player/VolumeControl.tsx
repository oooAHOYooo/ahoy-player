import React from "react";
import { VolumeIcon, MenuListIcon } from "../common/Icons";

type VolumeControlProps = {
  volume: number; // 0 to 1
  onChangeVolume: (val: number) => void;
  onToggleQueue?: () => void;
};

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  onChangeVolume,
  onToggleQueue,
}) => {
  const percent = Math.round(volume * 100);

  return (
    <div className="ahoy-player-volume-group">
      <button
        type="button"
        className="ahoy-volume-icon-btn"
        onClick={() => onChangeVolume(volume > 0 ? 0 : 0.75)}
        aria-label={volume > 0 ? "Mute" : "Unmute"}
      >
        <VolumeIcon size={18} />
      </button>

      <div className="ahoy-volume-slider-wrap">
        <input
          type="range"
          className="ahoy-volume-range-input"
          min="0"
          max="100"
          value={percent}
          onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
          style={{ "--range-progress": `${percent}%` } as React.CSSProperties}
          aria-label="Volume slider"
        />
      </div>

      <button
        type="button"
        className="ahoy-queue-toggle-btn"
        onClick={onToggleQueue}
        aria-label="Toggle playlist / queue"
      >
        <MenuListIcon size={18} />
      </button>
    </div>
  );
};
