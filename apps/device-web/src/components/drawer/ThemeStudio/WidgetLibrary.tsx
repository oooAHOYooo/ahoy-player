import React from "react";
import type { WidgetItem } from "../../../types/player-ui";

type WidgetLibraryProps = {
  widgetTitle?: string;
  items?: WidgetItem[];
};

const defaultWidgetItems: WidgetItem[] = [
  { id: "1", title: "Top 8 Tracks", duration: "13:31" },
  { id: "2", title: "Top 7 Tracks", duration: "13:38" },
  { id: "3", title: "Top 8 Tracks", duration: "13:31" },
];

export const WidgetLibrary: React.FC<WidgetLibraryProps> = ({
  widgetTitle = "Top 8 Tracks",
  items = defaultWidgetItems,
}) => {
  return (
    <div className="ahoy-theme-section ahoy-widget-library">
      <h3 className="ahoy-theme-section-title">Widget Library</h3>
      <div className="ahoy-drag-drop-slot">
        <span className="ahoy-drag-drop-hint">Drag-and drop slot</span>
        <div className="ahoy-widget-card" draggable="true">
          <h4 className="ahoy-widget-card-title">{widgetTitle}</h4>
          <ol className="ahoy-widget-card-list">
            {items.map((item, index) => (
              <li key={item.id} className="ahoy-widget-card-item">
                <span className="ahoy-widget-item-name">
                  {index + 1}. {item.title}
                </span>
                <span className="ahoy-widget-item-duration">{item.duration}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};
