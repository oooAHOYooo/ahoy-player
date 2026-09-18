import React from "react";
import { CloseIcon } from "../common/Icons";

type DrawerPanelProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export const DrawerPanel: React.FC<DrawerPanelProps> = ({
  title,
  onClose,
  children,
}) => {
  return (
    <section className="ahoy-drawer-panel" aria-label={title}>
      <header className="ahoy-drawer-header">
        <h2 className="ahoy-drawer-title">{title}</h2>
        <button
          type="button"
          className="ahoy-drawer-close"
          onClick={onClose}
          aria-label="Close panel"
        >
          <CloseIcon size={16} />
        </button>
      </header>
      <div className="ahoy-drawer-body">{children}</div>
    </section>
  );
};
