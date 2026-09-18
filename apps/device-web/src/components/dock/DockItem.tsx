import React from "react";
import type { DockTabId } from "../../types/player-ui";

type DockItemProps = {
  id: DockTabId;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
};

export const DockItem: React.FC<DockItemProps> = ({
  label,
  icon,
  active = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      className={`ahoy-dock-item ${active ? "is-active" : ""}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
    >
      <span className="ahoy-dock-item-icon">{icon}</span>
      <span className="ahoy-dock-item-label">{label}</span>
      {active && <span className="ahoy-dock-item-indicator" />}
    </button>
  );
};
