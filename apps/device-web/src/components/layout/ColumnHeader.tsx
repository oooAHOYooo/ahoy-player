import React from "react";
import { GripIcon, ArrowLeftIcon, ArrowRightIcon } from "../common/Icons";
import type { WorkspacePanelId } from "../../types/player-ui";

type ColumnHeaderProps = {
  columnIndex: 0 | 1 | 2;
  currentPanel: WorkspacePanelId;
  onChangePanel: (panel: WorkspacePanelId) => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
};

const PANEL_LABELS: Record<WorkspacePanelId, string> = {
  sidebar: "Library Navigation",
  grid: "Album Collection",
  queue: "Play Queue",
  visualizer: "Audio Visualizer",
  dial: "Rotary Dial Deck",
  "theme-studio": "Theme Studio",
  lyrics: "Synchronized Lyrics",
};

export const ColumnHeader: React.FC<ColumnHeaderProps> = ({
  columnIndex,
  currentPanel,
  onChangePanel,
  onMoveLeft,
  onMoveRight,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver = false,
}) => {
  const colNum = columnIndex + 1;

  return (
    <div
      className={`ahoy-col-header ${isDragOver ? "is-drag-over" : ""}`}
      aria-label={`Column ${colNum} header: ${PANEL_LABELS[currentPanel]}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Super obvious Grab Handle with tooltip */}
      <div
        className="ahoy-col-grab-handle"
        draggable="true"
        onDragStart={onDragStart}
        title="Click and drag to reorder this column, or use the arrow buttons"
        aria-grabbed="false"
      >
        <GripIcon size={14} className="ahoy-col-grab-icon" />
        <span className="ahoy-col-badge">Col {colNum}</span>
      </div>

      {/* Quick Shift Left / Shift Right Arrow Buttons */}
      <div className="ahoy-col-shift-controls" aria-label="Move column">
        <button
          type="button"
          className="ahoy-col-arrow-btn"
          disabled={columnIndex === 0}
          onClick={onMoveLeft}
          title={columnIndex > 0 ? `Move Col ${colNum} to Left` : "Already leftmost column"}
          aria-label={`Move column ${colNum} left`}
        >
          <ArrowLeftIcon size={12} />
        </button>
        <button
          type="button"
          className="ahoy-col-arrow-btn"
          disabled={columnIndex === 2}
          onClick={onMoveRight}
          title={columnIndex < 2 ? `Move Col ${colNum} to Right` : "Already rightmost column"}
          aria-label={`Move column ${colNum} right`}
        >
          <ArrowRightIcon size={12} />
        </button>
      </div>

      {/* Dropdown to switch panel content */}
      <div className="ahoy-col-select-wrap">
        <select
          className="ahoy-col-dropdown"
          value={currentPanel}
          onChange={(e) => onChangePanel(e.target.value as WorkspacePanelId)}
          title={`Change content of Column ${colNum}`}
          aria-label={`Select content for Column ${colNum}`}
        >
          {(Object.keys(PANEL_LABELS) as WorkspacePanelId[]).map((key) => (
            <option key={key} value={key}>
              {PANEL_LABELS[key]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
