import { apiCall } from "./client";
import type {
  DuplicateResults,
  StaleResults,
  QualityResults,
  TaxonomyResults,
} from "../types/tuneup";

export async function fetchDuplicates(): Promise<DuplicateResults> {
  const res = await apiCall("/agent/read/find_duplicate_tasks", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Duplicate analysis failed: ${res.status}`);
  const data = await res.json();
  return {
    groups: Array.isArray(data.groups) ? data.groups : [],
    totalTasks: data.totalTasks ?? 0,
  };
}

export async function fetchStaleItems(): Promise<StaleResults> {
  const res = await apiCall("/agent/read/find_stale_items", {
    method: "POST",
    body: JSON.stringify({ staleDays: 30 }),
  });
  if (!res.ok) throw new Error(`Stale analysis failed: ${res.status}`);
  const data = await res.json();
  return {
    staleTasks: Array.isArray(data.staleTasks) ? data.staleTasks : [],
    staleProjects: Array.isArray(data.staleProjects) ? data.staleProjects : [],
  };
}

export async function fetchQualityIssues(): Promise<QualityResults> {
  const res = await apiCall("/agent/read/analyze_task_quality", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Quality analysis failed: ${res.status}`);
  const data = await res.json();
  const results = Array.isArray(data.results)
    ? data.results.filter((r: { issues?: string[] }) => r.issues && r.issues.length > 0)
    : [];
  return { results, totalAnalyzed: data.totalAnalyzed ?? 0 };
}

export async function fetchTaxonomy(): Promise<TaxonomyResults> {
  const res = await apiCall("/agent/read/taxonomy_cleanup_suggestions", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Taxonomy analysis failed: ${res.status}`);
  const data = await res.json();
  return {
    similarProjects: Array.isArray(data.similarProjects) ? data.similarProjects : [],
    smallProjects: Array.isArray(data.smallProjects) ? data.smallProjects : [],
  };
}
