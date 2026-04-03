import type { ReactNode } from "react";

interface SegmentedOption {
  value: string;
  label?: string;
  ariaLabel?: string;
  icon?: ReactNode;
}

interface Props {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  iconOnly?: boolean;
  className?: string;
}

export function SegmentedControl({
  value,
  options,
  onChange,
  ariaLabel,
  iconOnly = false,
  className = "",
}: Props) {
  return (
    <div
      className={`view-toggle${iconOnly ? " view-toggle--icon-only" : ""}${className ? ` ${className}` : ""}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          aria-label={option.ariaLabel}
          className={`view-toggle__btn${value === option.value ? " view-toggle__btn--active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {!iconOnly && option.label && (
            <span className="view-toggle__label">{option.label}</span>
          )}
        </button>
      ))}
    </div>
  );
}
