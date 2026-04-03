import { useState, useRef } from "react";
import { IconSearch } from "./Icons";

interface Props {
  value: string;
  onChange: (query: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`search-bar${focused ? " search-bar--focused" : ""}`}>
      <span className="search-bar__icon" aria-hidden="true">
        <IconSearch size={14} />
      </span>
      <input
        id="searchInput"
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
