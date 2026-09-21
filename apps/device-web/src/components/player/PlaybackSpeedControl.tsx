import React, { useState, useRef, useEffect } from "react";
import { SpeedIcon } from "../common/Icons";

type PlaybackSpeedControlProps = {
  currentSpeed: number;
  onChangeSpeed: (speed: number) => void;
};

const SPEED_OPTIONS = [0.5, 0.75, 0.9, 1.0, 1.25, 1.5, 2.0];

export const PlaybackSpeedControl: React.FC<PlaybackSpeedControlProps> = ({
  currentSpeed = 1.0,
  onChangeSpeed,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const isCustomSpeed = currentSpeed !== 1.0;

  return (
    <div className="ahoy-speed-wrapper" ref={popoverRef}>
      <button
        type="button"
        className={`ahoy-speed-btn ${isCustomSpeed ? "is-custom" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title={`Playback Speed: ${currentSpeed}x (Click to change)`}
        aria-label="Playback speed"
      >
        <SpeedIcon size={12} className="ahoy-speed-icon" />
        <span>{currentSpeed}x</span>
      </button>

      {isOpen && (
        <div className="ahoy-speed-popover" role="menu" aria-label="Playback Speed Options">
          <div className="ahoy-speed-popover-title">PLAYBACK SPEED</div>
          <div className="ahoy-speed-options-list">
            {SPEED_OPTIONS.map((rate) => {
              const isSelected = Math.abs(currentSpeed - rate) < 0.01;
              return (
                <button
                  key={rate}
                  type="button"
                  className={`ahoy-speed-opt-btn ${isSelected ? "is-selected" : ""}`}
                  onClick={() => {
                    onChangeSpeed(rate);
                    setIsOpen(false);
                  }}
                >
                  <span>{rate}x</span>
                  {rate === 1.0 && <span className="ahoy-speed-label">Normal</span>}
                  {rate === 0.75 && <span className="ahoy-speed-label">Slowed</span>}
                  {rate === 1.25 && <span className="ahoy-speed-label">Brisk</span>}
                  {rate === 1.5 && <span className="ahoy-speed-label">Nightcore</span>}
                  {isSelected && <span className="ahoy-opt-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
