import { useState, useEffect } from "react";
import type { WorkspacePanelId, WorkspaceColumnLayout } from "../types/player-ui";

const STORAGE_KEY = "ahoy-player:workspace-columns:v2";

// Default 3-column layout: Left = sidebar, Center = album grid, Right = queue (Queue shows first!)
const DEFAULT_COLUMNS: WorkspaceColumnLayout = ["sidebar", "grid", "queue"];

export function useWorkspaceColumns() {
  const [columns, setColumns] = useState<WorkspaceColumnLayout>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 3) {
          return parsed as WorkspaceColumnLayout;
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_COLUMNS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    } catch {
      // Ignore storage errors
    }
  }, [columns]);

  const setColumnPanel = (columnIndex: 0 | 1 | 2, panelId: WorkspacePanelId) => {
    setColumns((prev) => {
      const updated = [...prev] as WorkspaceColumnLayout;
      updated[columnIndex] = panelId;
      return updated;
    });
  };

  const swapColumns = (colA: 0 | 1 | 2, colB: 0 | 1 | 2) => {
    setColumns((prev) => {
      const updated = [...prev] as WorkspaceColumnLayout;
      const temp = updated[colA];
      updated[colA] = updated[colB];
      updated[colB] = temp;
      return updated;
    });
  };

  const resetToDefault = () => {
    setColumns(DEFAULT_COLUMNS);
  };

  return {
    columns,
    setColumnPanel,
    swapColumns,
    resetToDefault,
  };
}
