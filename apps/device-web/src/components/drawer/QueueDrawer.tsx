import React from "react";
import { DrawerPanel } from "./DrawerPanel";
import type { AlbumCardData } from "../../types/player-ui";

type QueueDrawerProps = {
  onClose: () => void;
  queue: AlbumCardData[];
  currentTrackId?: string;
  onSelectTrack: (track: AlbumCardData) => void;
};

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  onClose,
  queue,
  currentTrackId,
  onSelectTrack,
}) => {
  return (
    <DrawerPanel title="Play Queue" onClose={onClose}>
      <div className="ahoy-drawer-queue-list">
        {queue.map((item, idx) => (
          <div
            key={item.id}
            className={`ahoy-drawer-queue-item ${item.id === currentTrackId ? "is-current" : ""}`}
            onClick={() => onSelectTrack(item)}
            role="button"
            tabIndex={0}
          >
            <span className="ahoy-queue-idx">{idx + 1}</span>
            <div className="ahoy-queue-info">
              <strong>{item.title}</strong>
              <small>{item.artist}</small>
            </div>
          </div>
        ))}
        {queue.length === 0 && (
          <p className="ahoy-drawer-empty-msg">Queue is empty</p>
        )}
      </div>
    </DrawerPanel>
  );
};
