import React from "react";
import { DrawerPanel } from "./DrawerPanel";

type LyricsDrawerProps = {
  onClose: () => void;
  title?: string;
  artist?: string;
};

export const LyricsDrawer: React.FC<LyricsDrawerProps> = ({
  onClose,
  title = "Ooo",
  artist = "Karen Dalton",
}) => {
  return (
    <DrawerPanel title="Lyrics" onClose={onClose}>
      <div className="ahoy-drawer-lyrics">
        <header className="ahoy-lyrics-header">
          <strong>{title}</strong>
          <span>{artist}</span>
        </header>
        <div className="ahoy-lyrics-content">
          <p>Local lyrics sync enabled</p>
          <p className="ahoy-lyrics-line is-active">Ooo, my love will stay</p>
          <p className="ahoy-lyrics-line">Through the morning haze</p>
          <p className="ahoy-lyrics-line">And the quiet days</p>
          <p className="ahoy-lyrics-line">Ooo, gentle river bend</p>
        </div>
      </div>
    </DrawerPanel>
  );
};
