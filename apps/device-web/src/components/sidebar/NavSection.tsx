import React from "react";

type NavSectionProps = {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

export const NavSection: React.FC<NavSectionProps> = ({ title, action, children }) => {
  return (
    <div className="ahoy-nav-section">
      <div className="ahoy-nav-section-header">
        <h3 className="ahoy-nav-section-title">{title}</h3>
        {action && <div className="ahoy-nav-section-action">{action}</div>}
      </div>
      <div className="ahoy-nav-section-items">{children}</div>
    </div>
  );
};
