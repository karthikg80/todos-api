import { useMemo } from "react";
import {
  getDefaultFieldsForTier,
  TIER_CAPS,
  type ResolvedFieldLayout,
} from "../types/fieldLayout";

/**
 * Returns field key lists per tier.
 *
 * Phase 1: hardcoded defaults from FIELD_REGISTRY.
 * Phase 5: upgraded to fetch resolved layout from backend,
 *          with local defaults as fallback on error.
 */
export function useFieldLayout(): ResolvedFieldLayout {
  return useMemo<ResolvedFieldLayout>(() => {
    const tier1All = getDefaultFieldsForTier(1);
    const tier2All = getDefaultFieldsForTier(2);

    return {
      quickEdit: tier1All.slice(0, TIER_CAPS.quickEdit),
      drawer: tier2All.slice(0, TIER_CAPS.drawer),
      meta: {
        hasSufficientHistory: false,
        pinnedQuickEdit: [],
        hiddenQuickEdit: [],
        pinnedDrawer: [],
        hiddenDrawer: [],
      },
    };
  }, []);
}
