interface HeadingComposerProps {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  onOpen: () => void;
  onClose: () => void;
}

export function HeadingComposer({
  open,
  value,
  onChange,
  onAdd,
  onOpen,
  onClose,
}: HeadingComposerProps) {
  return (
    <div
      className={`project-page__heading-composer${
        open ? " project-page__heading-composer--open" : ""
      }`}
    >
      {open ? (
        <>
          <input
            type="text"
            className="project-page__heading-composer-input"
            value={value}
            placeholder="Type a heading and press Enter"
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => {
              if (!value.trim()) onClose();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") onAdd();
              if (event.key === "Escape") {
                onChange("");
                onClose();
              }
            }}
            autoFocus
          />
          <span className="project-page__heading-rule" aria-hidden="true" />
        </>
      ) : (
        <button
          type="button"
          className="project-page__heading-composer-trigger"
          onClick={onOpen}
        >
          <span className="project-page__heading-rule" aria-hidden="true" />
          <span className="project-page__heading-composer-label">
            New heading
          </span>
        </button>
      )}
    </div>
  );
}
