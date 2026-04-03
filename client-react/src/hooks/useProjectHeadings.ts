import { useState, useEffect, useCallback } from "react";
import type { Heading } from "../types";
import { fetchProjectHeadings } from "../api/projects";

export function useProjectHeadings(projectId: string | null | undefined) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHeadings = useCallback(async () => {
    if (!projectId) {
      setHeadings([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchProjectHeadings(projectId);
      setHeadings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load headings");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadHeadings();
  }, [loadHeadings]);

  return { headings, loading, error, reload: loadHeadings };
}
