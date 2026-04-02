interface Props {
  label: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function GroupHeader({ label, count, isCollapsed, onToggle }: Props) {
  return (
    <div className="group-header">
      <button
        className="group-header__toggle"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
      >
        <svg
          className={`group-header__chevron${isCollapsed ? "" : " group-header__chevron--open"}`}
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span className="group-header__label">{label}</span>
      </button>
      <span className="group-header__count" aria-hidden="true">
        {count}
      </span>
    </div>
  );
}
