import { ToggleSwitch } from "../../shared/ToggleSwitch";
import { Field } from "../../shared/Field";

interface Props {
  dark: boolean;
  onToggleDark: () => void;
  uiMode: string;
  onToggleUiMode: () => void;
  density: string;
  onCycleDensity: () => void;
}

export function AppearanceTab({
  dark,
  onToggleDark,
  uiMode,
  onToggleUiMode,
  density,
  onCycleDensity,
}: Props) {
  const densityHint =
    density === "compact"
      ? "Tight spacing, smaller text"
      : density === "spacious"
        ? "More breathing room"
        : "Balanced default";
  return (
    <section className="settings-section">
      <ToggleSwitch
        checked={dark}
        label="Dark mode"
        description="Use the darker palette across the shell and task views."
        onChange={() => onToggleDark()}
      />
      <ToggleSwitch
        checked={uiMode === "normal"}
        label="Normal UI"
        description="Show the fuller workspace instead of the simplified mode."
        onChange={() => onToggleUiMode()}
      />
      <Field
        label="Density"
        htmlFor="settingsDensity"
        help={densityHint}
        layout="row"
      >
        <button id="settingsDensity" className="btn" onClick={onCycleDensity}>
          {density.charAt(0).toUpperCase() + density.slice(1)}
        </button>
      </Field>
    </section>
  );
}
