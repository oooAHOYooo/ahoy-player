import React, { useState } from "react";
import { AhoyDial, SignalField } from "@ahoy/player-ui-dial";
import type { DialAction } from "@ahoy/player-core";
import type { AlbumCardData } from "../../types/player-ui";

type AhoyDialPanelProps = {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  onSeek: (ratio: number) => void;
  positionMs: number;
  durationMs: number;
  nowPlaying?: AlbumCardData | null;
  onDialAction?: (action: DialAction) => void;
};

export const AhoyDialPanel: React.FC<AhoyDialPanelProps> = ({
  isPlaying,
  onTogglePlay,
  onNextTrack,
  onPreviousTrack,
  onSeek,
  positionMs,
  durationMs,
  nowPlaying,
  onDialAction,
}) => {
  const [controllerMode, setControllerMode] = useState<"wheel" | "signal">("wheel");
  const [lastActionText, setLastActionText] = useState<string>("Ready - Rotate dial or drag beacon");

  const progress = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;

  const handleDialDispatch = (action: DialAction) => {
    onDialAction?.(action);

    switch (action.type) {
      case "play":
        onTogglePlay();
        setLastActionText(isPlaying ? "Action: Pause" : "Action: Play");
        break;
      case "next":
        onNextTrack();
        setLastActionText("Action: Next Track");
        break;
      case "back":
        onPreviousTrack();
        setLastActionText("Action: Previous Track");
        break;
      case "turn":
        // Turn direction: +1 = forward, -1 = backward
        const deltaRatio = (action.direction * 5000) / Math.max(10000, durationMs || 180000);
        const newRatio = Math.min(1, Math.max(0, progress + deltaRatio));
        onSeek(newRatio);
        setLastActionText(`Action: Turn (${action.direction > 0 ? "+5s" : "-5s"})`);
        break;
      case "select":
        onTogglePlay();
        setLastActionText("Action: Select (Toggle Play)");
        break;
      case "menu":
        setControllerMode((prev) => (prev === "wheel" ? "signal" : "wheel"));
        setLastActionText("Action: Menu (Toggle Deck View)");
        break;
      default:
        break;
    }
  };

  return (
    <div className="ahoy-dial-panel" role="region" aria-label="Rotary Dial Deck">
      <div className="ahoy-dial-header">
        <div className="ahoy-dial-title-wrap">
          <span className="ahoy-dial-eyebrow">TACTILE CONTROLLER</span>
          <h3 className="ahoy-dial-title">AHOY Rotary Dial Deck</h3>
        </div>

        <div className="ahoy-dial-mode-group" role="tablist">
          <button
            type="button"
            className={`ahoy-dial-mode-btn ${controllerMode === "wheel" ? "is-active" : ""}`}
            onClick={() => setControllerMode("wheel")}
          >
            Rotary Dial
          </button>
          <button
            type="button"
            className={`ahoy-dial-mode-btn ${controllerMode === "signal" ? "is-active" : ""}`}
            onClick={() => setControllerMode("signal")}
          >
            Radar Beacon
          </button>
        </div>
      </div>

      <div className="ahoy-dial-stage">
        {controllerMode === "wheel" ? (
          <AhoyDial
            size="compact"
            isPlaying={isPlaying}
            dispatch={handleDialDispatch}
          />
        ) : (
          <div className="ahoy-dial-signal-wrap">
            <SignalField
              progress={progress}
              isPlaying={isPlaying}
              onSeek={onSeek}
              onToggle={onTogglePlay}
            />
          </div>
        )}

        <div className="ahoy-dial-action-feedback">
          {lastActionText}
        </div>
      </div>

      <div className="ahoy-dial-track-info">
        <div className="ahoy-dial-track-title">
          {nowPlaying ? nowPlaying.title : "No Track Selected"}
        </div>
        <div className="ahoy-dial-track-artist">
          {nowPlaying ? `${nowPlaying.artist} — ${nowPlaying.album}` : "Select a track to control"}
        </div>
      </div>

      <div className="ahoy-dial-guidance">
        <strong>Hardware & Input Controls:</strong>
        <br />
        • <strong>Drag or Scroll Ring</strong>: Scrub timeline forward/backward.
        <br />
        • <strong>Clickwheel Buttons</strong>: Menu, Back, Next, Play/Pause, and Center Select.
        <br />
        • <strong>Gamepad / USB Dial</strong>: Plug in Griffin PowerMate or gamepads for instant analog control.
      </div>
    </div>
  );
};
