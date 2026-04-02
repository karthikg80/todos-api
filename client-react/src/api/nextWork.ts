import { apiCall } from "./client";
import type { NextWorkInputs, NextWorkRecommendation } from "../types/nextWork";

export async function fetchNextWork(
  inputs: NextWorkInputs,
): Promise<NextWorkRecommendation[]> {
  const body: Record<string, unknown> = {};
  if (inputs.availableMinutes != null) body.availableMinutes = inputs.availableMinutes;
  if (inputs.energy != null) body.energy = inputs.energy;

  const res = await apiCall("/agent/read/decide_next_work", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Next work recommendation failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.decision?.recommendedTasks)
    ? data.decision.recommendedTasks
    : [];
}
