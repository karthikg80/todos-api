import { useState } from "react";
import { ViewHeader } from "./ViewHeader";
import { SegmentedControl } from "../shared/SegmentedControl";
import { ProfileTab } from "./settings/ProfileTab";
import { PlanningTab } from "./settings/PlanningTab";
import { AgentsTab } from "./settings/AgentsTab";
import { AppearanceTab } from "./settings/AppearanceTab";
import { IntegrationsTab } from "./settings/IntegrationsTab";
import { DangerTab } from "./settings/DangerTab";

type SettingsTab =
  | "profile"
  | "planning"
  | "agents"
  | "appearance"
  | "integrations"
  | "danger";

const TAB_OPTIONS: ReadonlyArray<{ value: SettingsTab; label: string }> = [
  { value: "profile", label: "Profile" },
  { value: "planning", label: "Planning" },
  { value: "agents", label: "Agents" },
  { value: "appearance", label: "Appearance" },
  { value: "integrations", label: "Integrations" },
  { value: "danger", label: "Danger" },
];

interface Props {
  dark: boolean;
  onToggleDark: () => void;
  uiMode: string;
  onToggleUiMode: () => void;
  density: string;
  onCycleDensity: () => void;
  onBack: () => void;
  onOpenTuneUp: () => void;
}

export function SettingsPage({
  dark,
  onToggleDark,
  uiMode,
  onToggleUiMode,
  density,
  onCycleDensity,
  onBack,
  onOpenTuneUp,
}: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  return (
    <div id="settingsPane" className="settings-page">
      <ViewHeader
        title="Settings"
        back={{ onClick: onBack }}
        controls={
          <SegmentedControl
            ariaLabel="Settings tab"
            value={activeTab}
            onChange={(value) => setActiveTab(value as SettingsTab)}
            className="settings-tabs"
            options={TAB_OPTIONS.map(({ value, label }) => ({
              value,
              label,
              buttonId: `settingsTab-${value}`,
            }))}
          />
        }
      />
      <div className="settings-tabs__panel" role="tabpanel">
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "planning" && <PlanningTab />}
        {activeTab === "agents" && <AgentsTab />}
        {activeTab === "appearance" && (
          <AppearanceTab
            dark={dark}
            onToggleDark={onToggleDark}
            uiMode={uiMode}
            onToggleUiMode={onToggleUiMode}
            density={density}
            onCycleDensity={onCycleDensity}
          />
        )}
        {activeTab === "integrations" && <IntegrationsTab />}
        {activeTab === "danger" && <DangerTab onOpenTuneUp={onOpenTuneUp} />}
      </div>
    </div>
  );
}
