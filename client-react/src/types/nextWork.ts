export interface NextWorkInputs {
  availableMinutes?: number;
  energy?: "low" | "medium" | "high";
}

export interface NextWorkRecommendation {
  taskId: string;
  projectId?: string | null;
  title: string;
  reason: string;
  impact: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
}

export interface NextWorkResult {
  recommendations: NextWorkRecommendation[];
  inputs: NextWorkInputs;
  fetchedAt: number;
}
