import React from "react";

type WindowTitleBarProps = {
  title?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
};

export const WindowTitleBar: React.FC<WindowTitleBarProps> = ({
  title = "Ahoy Player",
  onClose,
  onMinimize,
  onMaximize,
}) => {
  return (
    <header className="ahoy-window-titlebar">
      <div className="ahoy-window-traffic-lights" aria-label="Window controls">
        <button
          type="button"
          className="traffic-light traffic-light--close"
          onClick={onClose}
          aria-label="Close window"
        />
        <button
          type="button"
          className="traffic-light traffic-light--minimize"
          onClick={onMinimize}
          aria-label="Minimize window"
        />
        <button
          type="button"
          className="traffic-light traffic-light--maximize"
          onClick={onMaximize}
          aria-label="Maximize window"
        />
      </div>
      <div className="ahoy-window-title">{title}</div>
      <div className="ahoy-window-spacer" />
    </header>
  );
};
