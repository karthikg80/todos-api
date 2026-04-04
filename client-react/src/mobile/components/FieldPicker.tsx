import { useState } from "react";

interface FieldPickerOption<T extends string> {
  key: T;
  label: string;
  color?: string;
}

interface FieldPickerProps<T extends string> {
  label: string;
  value: T | null;
  options: FieldPickerOption<T>[];
  onChange: (value: T | null) => void;
  allowClear?: boolean;
}

export function FieldPicker<T extends string>({
  label,
  value,
  options,
  onChange,
  allowClear = false,
}: FieldPickerProps<T>) {
  const [open, setOpen] = useState(false);

  const selectedOption = value ? options.find((o) => o.key === value) : null;

  function handleSelect(key: T) {
    onChange(key);
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setOpen(false);
  }

  return (
    <div className={`m-field-picker${open ? " m-field-picker--open" : ""}`}>
      <button
        className="m-field-picker__header"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <div className="m-sheet-full__field-label">{label}</div>
        <div
          className="m-sheet-full__field-value"
          style={selectedOption?.color ? { color: selectedOption.color } : undefined}
        >
          {selectedOption ? selectedOption.label : "—"}
          <span className="m-field-picker__chevron">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && (
        <div className="m-field-picker__options">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`m-field-picker__option${value === opt.key ? " m-field-picker__option--active" : ""}`}
              style={opt.color ? { color: opt.color } : undefined}
              onClick={() => handleSelect(opt.key)}
            >
              {value === opt.key && (
                <span className="m-field-picker__option-check">✓</span>
              )}
              {opt.label}
            </button>
          ))}
          {allowClear && value !== null && (
            <button
              type="button"
              className="m-field-picker__clear"
              onClick={handleClear}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
