import { useCallback, useEffect, useState } from "react";
import { apiCall } from "../api/client";
import type { Heading } from "../types";

export function useProjectHeadings(projectId: string | null) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHeadings = useCallback(async () => {
    if (!projectId) {
      setHeadings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await apiCall(`/projects/${projectId}/headings`);
      if (!res.ok) {
        setHeadings([]);
        return;
      }
      const data = (await res.json()) as Heading[];
      setHeadings(Array.isArray(data) ? data : []);
    } catch {
      setHeadings([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadHeadings();
  }, [loadHeadings]);

  const addHeading = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!projectId || !trimmed) return null;

      try {
        const res = await apiCall(`/projects/${projectId}/headings`, {
          method: "POST",
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) return null;
        const created = (await res.json()) as Heading;
        setHeadings((prev) => [...prev, created]);
        return created;
      } catch {
        return null;
      }
    },
    [projectId],
  );

  const reorderHeadings = useCallback(
    async (nextHeadings: Heading[]) => {
      if (!projectId) return null;

      const previous = headings;
      setHeadings(nextHeadings);

      try {
        const res = await apiCall(`/projects/${projectId}/headings/reorder`, {
          method: "PUT",
          body: JSON.stringify(
            nextHeadings.map((heading, index) => ({
              id: heading.id,
              sortOrder: index,
            })),
          ),
        });
        if (!res.ok) {
          setHeadings(previous);
          return null;
        }
        const reordered = (await res.json()) as Heading[];
        setHeadings(Array.isArray(reordered) ? reordered : nextHeadings);
        return reordered;
      } catch {
        setHeadings(previous);
        return null;
      }
    },
    [headings, projectId],
  );

  return {
    headings,
    loading,
    loadHeadings,
    addHeading,
    reorderHeadings,
  };
}
