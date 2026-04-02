export type TuneUpSection = "duplicates" | "stale" | "quality" | "taxonomy";

// --- Duplicates ---
export interface DuplicateTask {
  id: string;
  title: string;
  status: string;
  projectId: string | null;
}

export interface DuplicateGroup {
  confidence: number;
  reason: string;
  tasks: DuplicateTask[];
  suggestedAction: "merge" | "archive-older" | "review";
}

export interface DuplicateResults {
  groups: DuplicateGroup[];
  totalTasks: number;
}

// --- Stale ---
export interface StaleTask {
  id: string;
  title: string;
  status?: string;
  lastUpdated?: string;
}

export interface StaleProject {
  id: string;
  name: string;
  lastUpdated?: string;
}

export interface StaleResults {
  staleTasks: StaleTask[];
  staleProjects: StaleProject[];
}

// --- Quality ---
export interface QualityIssue {
  id: string;
  title: string;
  qualityScore: number;
  issues: string[];
  suggestions: string[];
}

export interface QualityResults {
  results: QualityIssue[];
  totalAnalyzed: number;
}

// --- Taxonomy ---
export interface SimilarProjectPair {
  projectAName: string;
  projectBName: string;
  projectAId?: string;
  projectBId?: string;
}

export interface SmallProject {
  name: string;
  id?: string;
  taskCount: number;
}

export interface TaxonomyResults {
  similarProjects: SimilarProjectPair[];
  smallProjects: SmallProject[];
}

// --- Aggregate ---
export interface TuneUpData {
  duplicates: DuplicateResults | null;
  stale: StaleResults | null;
  quality: QualityResults | null;
  taxonomy: TaxonomyResults | null;
}
