import { useState } from "react";
import type { Heading } from "../../types";

interface Props {
  headings: Heading[];
  loading?: boolean;
  activeHeadingId: string | null;
  onSelectHeading: (id: string | null) => void;
  onAddHeading: (name: string) => Promise<unknown>;
}

export function ProjectHeadings({
  headings,
  loading = false,
  activeHeadingId,
  onSelectHeading,
  onAddHeading,
}: Props) {
  const [newName, setNewName] = useState("");

  const handleAddHeading = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const created = await onAddHeading(trimmed);
    if (created) {
      setNewName("");
    }
  };

  if (loading && headings.length === 0) return null;

  return (
    <div className="project-headings">
      <button
        className={`project-headings__item${activeHeadingId === null ? " project-headings__item--active" : ""}`}
        onClick={() => onSelectHeading(null)}
      >
        All tasks
      </button>
      {headings.map((heading) => (
        <button
          key={heading.id}
          className={`project-headings__item${activeHeadingId === heading.id ? " project-headings__item--active" : ""}`}
          onClick={() => onSelectHeading(heading.id)}
        >
          {heading.name}
        </button>
      ))}
      <div className="project-headings__add">
        <input
          className="project-headings__input"
          type="text"
          placeholder="+ Add section"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleAddHeading();
            }
          }}
        />
      </div>
    </div>
  );
}
