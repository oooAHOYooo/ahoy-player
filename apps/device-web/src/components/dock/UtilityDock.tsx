import React from "react";
import { DockItem } from "./DockItem";
import {
  QueueIcon,
  LyricsIcon,
  ThemeStudioIcon,
  SettingsIcon,
  WaveformIcon,
  DialIcon,
} from "../common/Icons";
import type { DockTabId } from "../../types/player-ui";

type UtilityDockProps = {
  activeTab: DockTabId | null;
  onSelectTab: (tab: DockTabId) => void;
};

export const UtilityDock: React.FC<UtilityDockProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <aside className="ahoy-utility-dock" aria-label="Utility dock">
      <div className="ahoy-dock-group ahoy-dock-group--top">
        <DockItem
          id="queue"
          label="Queue"
          icon={<QueueIcon size={18} />}
          active={activeTab === "queue"}
          onClick={() => onSelectTab("queue")}
        />
        <DockItem
          id="visualizer"
          label="Audio Visualizer"
          icon={<WaveformIcon size={18} />}
          active={activeTab === "visualizer"}
          onClick={() => onSelectTab("visualizer")}
        />
        <DockItem
          id="dial"
          label="Rotary Dial Deck"
          icon={<DialIcon size={18} />}
          active={activeTab === "dial"}
          onClick={() => onSelectTab("dial")}
        />
        <DockItem
          id="lyrics"
          label="Lyrics"
          icon={<LyricsIcon size={18} />}
          active={activeTab === "lyrics"}
          onClick={() => onSelectTab("lyrics")}
        />
        <DockItem
          id="theme-studio"
          label="Theme Studio"
          icon={<ThemeStudioIcon size={18} />}
          active={activeTab === "theme-studio"}
          onClick={() => onSelectTab("theme-studio")}
        />
      </div>

      <div className="ahoy-dock-group ahoy-dock-group--bottom">
        <button
          type="button"
          className={`ahoy-dock-item ahoy-dock-settings ${activeTab === "settings" ? "is-active" : ""}`}
          onClick={() => onSelectTab("settings")}
          aria-label="Settings"
        >
          <SettingsIcon size={18} />
        </button>
      </div>
    </aside>
  );
};
