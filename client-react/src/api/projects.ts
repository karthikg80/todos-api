import { apiCall } from "./client";
import type { Project } from "../types";

export async function fetchProjects(): Promise<Project[]> {
  const res = await apiCall("/projects");
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json();
}
