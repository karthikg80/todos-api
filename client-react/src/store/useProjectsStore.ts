import { useState, useCallback } from "react";
import type { Project } from "../types";
import { fetchProjects } from "../api/projects";

export function useProjectsStore() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch {
      // Projects may not be configured — that's OK
    } finally {
      setLoading(false);
    }
  }, []);

  return { projects, loading, loadProjects };
}
