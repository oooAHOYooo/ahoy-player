import React from "react";

type NavItemProps = {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  count?: number;
};

export const NavItem: React.FC<NavItemProps> = ({
  label,
  icon,
  active = false,
  onClick,
  count,
}) => {
  return (
    <button
      type="button"
      className={`ahoy-nav-item ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      <span className="ahoy-nav-item-icon">{icon}</span>
      <span className="ahoy-nav-item-label">{label}</span>
      {typeof count === "number" && (
        <span className="ahoy-nav-item-count">{count}</span>
      )}
    </button>
  );
};
