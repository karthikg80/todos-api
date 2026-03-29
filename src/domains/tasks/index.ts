/**
 * Tasks domain — public API.
 *
 * Other domains should import from this barrel file only,
 * never reaching into internal modules directly.
 */

export {
  isValidTransition,
  availableTransitions,
  classifyStatus,
  reconcileStatusAndCompletion,
  deriveStatusFromLegacyFields,
  ALL_STATUSES,
  OPEN_STATUSES,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  BLOCKED_STATUSES,
} from "./taskLifecycle";

export {
  AppError,
  NotFoundError,
  ValidationError,
  ConflictError,
  QuotaExceededError,
  ForbiddenError,
  LifecycleTransitionError,
  InvalidRelationError,
} from "./domainErrors";
