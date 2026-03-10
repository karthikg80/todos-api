// =============================================================================
// featureFlags.js — Feature flag evaluation helpers.
// No dependencies on other app modules.
// =============================================================================
import { STORAGE_KEYS } from "../utils/storageKeys.js";

export function readBooleanFeatureFlag(flagKey) {
  try {
    const rawValue = window.localStorage.getItem(flagKey);
    return rawValue === "1" || rawValue === "true";
  } catch {
    return false;
  }
}

export function isEnhancedTaskCriticEnabled() {
  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get("enhancedCritic");
  if (queryValue === "1" || queryValue === "true") return true;
  if (queryValue === "0" || queryValue === "false") return false;
  return readBooleanFeatureFlag(STORAGE_KEYS.FEATURE_ENHANCED_TASK_CRITIC);
}

export function isTaskDrawerDecisionAssistEnabled() {
  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get("taskDrawerAssist");
  if (queryValue === "1" || queryValue === "true") return true;
  if (queryValue === "0" || queryValue === "false") return false;
  return readBooleanFeatureFlag(STORAGE_KEYS.FEATURE_TASK_DRAWER_ASSIST);
}
