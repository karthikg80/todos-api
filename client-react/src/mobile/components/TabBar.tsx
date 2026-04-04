import type { MobileTab } from "../hooks/useTabBar";
import { CUSTOM_TAB_OPTIONS } from "../hooks/useTabBar";

interface Props {
  activeTab: MobileTab;
  customView: string;
  onTabChange: (tab: MobileTab) => void;
  onFabPress: () => void;
}

function getCustomLabel(view: string): string {
  return CUSTOM_TAB_OPTIONS.find((o) => o.key === view)?.label ?? "More";
}

export function TabBar({ activeTab, customView, onTabChange, onFabPress }: Props) {
  return (
    <nav className="m-tab-bar" role="tablist" aria-label="Main navigation">
      <button
        className={`m-tab-bar__tab${activeTab === "focus" ? " m-tab-bar__tab--active" : ""}`}
        role="tab"
        aria-selected={activeTab === "focus"}
        onClick={() => onTabChange("focus")}
      >
        <span className="m-tab-bar__icon" aria-hidden="true">◉</span>
        <span className="m-tab-bar__label">Focus</span>
      </button>
      <button
        className={`m-tab-bar__tab${activeTab === "today" ? " m-tab-bar__tab--active" : ""}`}
        role="tab"
        aria-selected={activeTab === "today"}
        onClick={() => onTabChange("today")}
      >
        <span className="m-tab-bar__icon" aria-hidden="true">☀</span>
        <span className="m-tab-bar__label">Today</span>
      </button>
      <button className="m-tab-bar__fab" aria-label="Quick capture" onClick={() => { if (navigator.vibrate) navigator.vibrate(5); onFabPress(); }}>
        <span className="m-tab-bar__fab-icon">+</span>
      </button>
      <button
        className={`m-tab-bar__tab${activeTab === "projects" ? " m-tab-bar__tab--active" : ""}`}
        role="tab"
        aria-selected={activeTab === "projects"}
        onClick={() => onTabChange("projects")}
      >
        <span className="m-tab-bar__icon" aria-hidden="true">▤</span>
        <span className="m-tab-bar__label">Projects</span>
      </button>
      <button
        className={`m-tab-bar__tab${activeTab === "custom" ? " m-tab-bar__tab--active" : ""}`}
        role="tab"
        aria-selected={activeTab === "custom"}
        onClick={() => onTabChange("custom")}
      >
        <span className="m-tab-bar__icon" aria-hidden="true">≡</span>
        <span className="m-tab-bar__label">{getCustomLabel(customView)}</span>
      </button>
    </nav>
  );
}
