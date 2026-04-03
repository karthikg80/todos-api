import { apiCall } from "./client";
import type { Project, Heading } from "../types";

export async function fetchProjects(): Promise<Project[]> {
  const res = await apiCall("/projects");
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json();
}

export async function fetchProjectHeadings(
  projectId: string,
): Promise<Heading[]> {
  const res = await apiCall(`/projects/${projectId}/headings`);
  if (!res.ok) throw new Error(`Failed to fetch project headings: ${res.status}`);
  return res.json();
}
