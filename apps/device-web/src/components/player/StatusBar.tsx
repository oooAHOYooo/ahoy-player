import React from "react";

type StatusBarProps = {
  statusText?: string;
  subText?: string;
};

export const StatusBar: React.FC<StatusBarProps> = ({
  statusText = "READY.",
  subText = "QUEUE NATIVE RUST STATE. LOCAL FILES NEVER UPLOADED.",
}) => {
  return (
    <footer className="ahoy-player-status-line" role="status">
      <span className="ahoy-status-badge">{statusText}</span>
      <span className="ahoy-status-detail">{subText}</span>
    </footer>
  );
};
