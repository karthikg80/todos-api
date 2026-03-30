import { useState, useEffect, useCallback } from "react";
import { apiCall } from "../../api/client";
import type { Heading } from "../../types";

interface Props {
  projectId: string;
  activeHeadingId: string | null;
  onSelectHeading: (id: string | null) => void;
}

export function ProjectHeadings({
  projectId,
  activeHeadingId,
  onSelectHeading,
}: Props) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    setLoading(true);
    apiCall(`/projects/${projectId}/headings`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setHeadings(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const addHeading = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const res = await apiCall(`/projects/${projectId}/headings`, {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const created = await res.json();
        setHeadings((prev) => [...prev, created]);
        setNewName("");
      }
    } catch {}
  }, [projectId, newName]);

  if (loading && headings.length === 0) return null;

  return (
    <div className="project-headings">
      <button
        className={`project-headings__item${activeHeadingId === null ? " project-headings__item--active" : ""}`}
        onClick={() => onSelectHeading(null)}
      >
        All
      </button>
      {headings.map((h) => (
        <button
          key={h.id}
          className={`project-headings__item${activeHeadingId === h.id ? " project-headings__item--active" : ""}`}
          onClick={() => onSelectHeading(h.id)}
        >
          {h.name}
        </button>
      ))}
      <div className="project-headings__add">
        <input
          className="project-headings__input"
          type="text"
          placeholder="+ Add section"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addHeading();
          }}
        />
      </div>
    </div>
  );
}
