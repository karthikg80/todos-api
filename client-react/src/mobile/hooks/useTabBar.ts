import { useState, useCallback } from "react";
import type { WorkspaceView } from "../../components/projects/Sidebar";

export type MobileTab = "focus" | "today" | "projects" | "custom";

const CUSTOM_TAB_KEY = "mobile:customTab";

export const CUSTOM_TAB_OPTIONS: { key: WorkspaceView; label: string }[] = [
  { key: "horizon", label: "Upcoming" },
  { key: "all", label: "Everything" },
  { key: "completed", label: "Completed" },
];

function getStoredCustomView(): WorkspaceView {
  const stored = localStorage.getItem(CUSTOM_TAB_KEY);
  if (stored && CUSTOM_TAB_OPTIONS.some((o) => o.key === stored)) {
    return stored as WorkspaceView;
  }
  return "horizon";
}

export function useTabBar() {
  const [activeTab, setActiveTab] = useState<MobileTab>("focus");
  const [customView, setCustomViewState] = useState<WorkspaceView>(getStoredCustomView);

  const setCustomView = useCallback((view: WorkspaceView) => {
    setCustomViewState(view);
    localStorage.setItem(CUSTOM_TAB_KEY, view);
  }, []);

  return { activeTab, setActiveTab, customView, setCustomView };
}
