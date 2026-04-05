// src/types/focusBrief.ts

export interface TaskItem {
  id: string;
  title: string;
  dueDate: string | null;
  estimateMinutes: number | null;
  priority: string;
  overdue: boolean;
}

export interface AgendaItem extends TaskItem {
  completed: boolean;
}

export interface UrgentItem {
  title: string;
  dueDate: string;
  reason: string;
}

export interface TopRecommendation {
  title: string;
  taskId: string;
  reasoning: string;
}

export interface RightNow {
  urgentItems: UrgentItem[];
  topRecommendation: TopRecommendation | null;
}

export interface WhatNextItem {
  id: string;
  title: string;
  reason: string;
  impact: "low" | "medium" | "high";
  effort: string;
}

export interface UnsortedPanelData {
  type: "unsorted";
  items: Array<{ id: string; title: string }>;
}

export interface DueSoonGroup {
  label: string;
  items: TaskItem[];
}

export interface DueSoonPanelData {
  type: "dueSoon";
  groups: DueSoonGroup[];
}

export interface WhatNextPanelData {
  type: "whatNext";
  items: WhatNextItem[];
}

export interface BacklogHygienePanelData {
  type: "backlogHygiene";
  items: Array<{ id: string; title: string; staleDays: number }>;
}

export interface ProjectToNudge {
  id: string;
  name: string;
  overdueCount: number;
  waitingCount: number;
  dueSoonCount: number;
}

export interface ProjectsToNudgePanelData {
  type: "projectsToNudge";
  items: ProjectToNudge[];
}

export interface TrackOverviewPanelData {
  type: "trackOverview";
  columns: {
    thisWeek: TaskItem[];
    next14Days: TaskItem[];
    later: TaskItem[];
  };
}

export interface RescueModePanelData {
  type: "rescueMode";
  openCount: number;
  overdueCount: number;
}

export type PanelData =
  | UnsortedPanelData
  | DueSoonPanelData
  | WhatNextPanelData
  | BacklogHygienePanelData
  | ProjectsToNudgePanelData
  | TrackOverviewPanelData
  | RescueModePanelData;

export type PanelType = PanelData["type"];

export interface PanelProvenance {
  source: "llm" | "deterministic";
  model?: string;
  temperature?: number;
  maxTokens?: number;
  generatedAt?: string;
  cacheStatus?: "hit" | "miss" | "stale";
  cacheExpiresAt?: string;
  inputSummary?: string;
  promptIntent?: string;
  method?: string;
  freshness?: "fresh" | "stale" | "cached";
  filter?: string;
  dataBreakdown?: string;
  itemsShown?: string;
  logic?: string;
}

export interface RankedPanel {
  type: PanelType;
  reason: string;
  data: PanelData;
  provenance: PanelProvenance;
}

export interface FocusBriefResponse {
  pinned: {
    rightNow: RightNow;
    todayAgenda: AgendaItem[];
    rightNowProvenance: PanelProvenance;
    todayAgendaProvenance: PanelProvenance;
  };
  rankedPanels: RankedPanel[];
  generatedAt: string;
  expiresAt: string;
  cached: boolean;
  isStale: boolean;
}

export interface LlmFocusOutput {
  rightNow: RightNow;
  whatNext: WhatNextItem[];
  panelRanking: Array<{ type: PanelType; reason: string }>;
}
