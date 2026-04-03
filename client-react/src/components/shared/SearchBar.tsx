import { useState, useRef } from "react";
import { IconSearch } from "./Icons";

interface Props {
  value: string;
  onChange: (query: string) => void;
  inputId?: string;
}

export function SearchBar({
  value,
  onChange,
  inputId = "searchInput",
}: Props) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`search-bar${focused ? " search-bar--focused" : ""}`}>
      <span className="search-bar__icon" aria-hidden="true">
        <IconSearch size={14} />
      </span>
      <input
        id={inputId}
        data-search-input="true"
        ref={inputRef}
        className="search-bar__input"
        type="text"
        placeholder="Search tasks…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {value && (
        <button
          className="search-bar__clear"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
