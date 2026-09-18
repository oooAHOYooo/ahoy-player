import React from "react";

type NavSectionProps = {
  title: string;
  children: React.ReactNode;
};

export const NavSection: React.FC<NavSectionProps> = ({ title, children }) => {
  return (
    <div className="ahoy-nav-section">
      <h3 className="ahoy-nav-section-title">{title}</h3>
      <div className="ahoy-nav-section-items">{children}</div>
    </div>
  );
};
