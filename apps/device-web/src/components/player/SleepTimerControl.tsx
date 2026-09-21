import React, { useState, useRef, useEffect } from "react";
import { MoonIcon } from "../common/Icons";
import type { SleepTimerOption } from "../../hooks/useSleepTimer";

type SleepTimerControlProps = {
  selectedOption: SleepTimerOption;
  formattedRemaining: string | null;
  onSetTimer: (option: SleepTimerOption) => void;
};

export const SleepTimerControl: React.FC<SleepTimerControlProps> = ({
  selectedOption,
  formattedRemaining,
  onSetTimer,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const isActive = selectedOption !== "off";

  // Close popover on outside click
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

  const handleSelect = (opt: SleepTimerOption) => {
    onSetTimer(opt);
    setIsOpen(false);
  };

  return (
    <div className="ahoy-sleep-timer-wrapper" ref={popoverRef}>
      <button
        type="button"
        className={`ahoy-volume-icon-btn ahoy-sleep-timer-trigger ${isActive ? "is-active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title={isActive ? `Sleep Timer Active (${formattedRemaining})` : "Set Sleep Timer (Night Watch)"}
        aria-label="Sleep timer"
      >
        <MoonIcon size={16} />
        {isActive && formattedRemaining && (
          <span className="ahoy-sleep-badge">{formattedRemaining}</span>
        )}
      </button>

      {isOpen && (
        <div className="ahoy-sleep-popover" role="dialog" aria-label="Sleep Timer Options">
          <div className="ahoy-sleep-popover-header">
            <span className="ahoy-sleep-popover-eyebrow">NIGHT WATCH</span>
            <div className="ahoy-sleep-popover-title">Sleep Timer</div>
            {isActive && formattedRemaining && (
              <div className="ahoy-sleep-popover-status">
                Stopping in <span className="ahoy-sleep-highlight">{formattedRemaining}</span>
              </div>
            )}
          </div>

          <div className="ahoy-sleep-options-list">
            <button
              type="button"
              className={`ahoy-sleep-opt-btn ${selectedOption === "15" ? "is-selected" : ""}`}
              onClick={() => handleSelect("15")}
            >
              <span>15 Minutes</span>
              {selectedOption === "15" && <span className="ahoy-opt-check">✓</span>}
            </button>
            <button
              type="button"
              className={`ahoy-sleep-opt-btn ${selectedOption === "30" ? "is-selected" : ""}`}
              onClick={() => handleSelect("30")}
            >
              <span>30 Minutes</span>
              {selectedOption === "30" && <span className="ahoy-opt-check">✓</span>}
            </button>
            <button
              type="button"
              className={`ahoy-sleep-opt-btn ${selectedOption === "45" ? "is-selected" : ""}`}
              onClick={() => handleSelect("45")}
            >
              <span>45 Minutes</span>
              {selectedOption === "45" && <span className="ahoy-opt-check">✓</span>}
            </button>
            <button
              type="button"
              className={`ahoy-sleep-opt-btn ${selectedOption === "60" ? "is-selected" : ""}`}
              onClick={() => handleSelect("60")}
            >
              <span>60 Minutes (1 Hour)</span>
              {selectedOption === "60" && <span className="ahoy-opt-check">✓</span>}
            </button>
            <button
              type="button"
              className={`ahoy-sleep-opt-btn ${selectedOption === "track" ? "is-selected" : ""}`}
              onClick={() => handleSelect("track")}
            >
              <span>End of Current Track</span>
              {selectedOption === "track" && <span className="ahoy-opt-check">✓</span>}
            </button>

            {isActive && (
              <button
                type="button"
                className="ahoy-sleep-opt-btn ahoy-sleep-opt-btn--cancel"
                onClick={() => handleSelect("off")}
              >
                <span>✕ Turn Off Timer</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
