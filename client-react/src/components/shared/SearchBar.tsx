import { useState, useRef } from "react";
import { IconClose, IconSearch } from "./Icons";

interface Props {
  value: string;
  onChange: (query: string) => void;
  inputId?: string;
  shortcutHint?: string;
}

export function SearchBar({
  value,
  onChange,
  inputId = "searchInput",
  shortcutHint,
}: Props) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = value.trim().length > 0;

  return (
    <div
      className={`search-bar${focused ? " search-bar--focused" : ""}${hasValue ? " search-bar--filled" : ""}`}
    >
      <span className="search-bar__icon" aria-hidden="true">
        <IconSearch size={14} />
      </span>
      <input
        id={inputId}
        data-search-input="true"
        ref={inputRef}
        className="search-bar__input"
        data-global-search-input="true"
        type="text"
        placeholder="Search tasks…"
        aria-label="Search tasks"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <div className="search-bar__accessory">
        {!hasValue && shortcutHint && (
          <span className="search-bar__hint" aria-hidden="true">
            {shortcutHint}
          </span>
        )}
        {value && (
          <button
            type="button"
            className="search-bar__clear"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <IconClose size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
