interface Props {
  checked: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleSwitch({
  checked,
  label,
  description,
  disabled = false,
  onChange,
}: Props) {
  return (
    <div
      className={`toggle-switch${disabled ? " toggle-switch--disabled" : ""}`}
    >
      <div className="toggle-switch__copy">
        <span className="toggle-switch__label">{label}</span>
        {description && (
          <span className="toggle-switch__description">{description}</span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle-switch__control${checked ? " toggle-switch__control--checked" : ""}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-switch__thumb" />
      </button>
    </div>
  );
}
