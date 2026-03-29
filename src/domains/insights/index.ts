/**
 * Insights domain — public API.
 *
 * Re-exports insight services from their current location.
 */

export {
  InsightsComputeService,
  ProjectHealthResult,
} from "../../services/insightsComputeService";

export { InsightsService } from "../../services/insightsService";
