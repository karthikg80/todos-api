import { DecisionAssistSurface } from "./aiContracts";
import { AiSuggestionRecord } from "./aiSuggestionStore";

const REJECT_WINDOW_MS = 30 * 60 * 1000;
const REJECT_THRESHOLD = 3;
const REJECT_THROTTLE_MS = 20 * 60 * 1000;

const QUICK_REVERT_WINDOW_MS = 10 * 60 * 1000;
const QUICK_REVERT_LOOKBACK_MS = 60 * 60 * 1000;
const QUICK_REVERT_THRESHOLD = 2;
const QUICK_REVERT_THROTTLE_MS = 45 * 60 * 1000;

const RECOVERY_ACCEPT_THRESHOLD = 2;
const MAX_RECORDS = 120;

export interface DecisionAssistThrottleResult {
  throttled: boolean;
  reason: "reject_burst" | "quick_revert_burst" | null;
  throttleUntil: Date | null;
}

const parseIsoDate = (value: unknown): Date | null => {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const extractSurface = (
  record: AiSuggestionRecord,
): DecisionAssistSurface | "" => {
  const inputSurface =
    typeof record.input?.surface === "string" ? record.input.surface : "";
  if (
    inputSurface === "task_drawer" ||
    inputSurface === "on_create" ||
    inputSurface === "today_plan"
  ) {
    return inputSurface;
  }
  return "";
};

const extractSignalTime = (record: AiSuggestionRecord): Date => {
  const feedbackUpdatedAt = parseIsoDate(record.feedback?.updatedAt);
  return feedbackUpdatedAt || record.updatedAt || record.createdAt;
};

const isQuickRevert = (record: AiSuggestionRecord, signalAt: Date): boolean => {
  if (record.status !== "rejected") {
    return false;
  }
  if (!(record.appliedAt instanceof Date)) {
    return false;
  }
  const delta = signalAt.getTime() - record.appliedAt.getTime();
  return delta >= 0 && delta <= QUICK_REVERT_WINDOW_MS;
};

export function evaluateDecisionAssistThrottle(params: {
  records: AiSuggestionRecord[];
  surface: DecisionAssistSurface;
  now: Date;
}): DecisionAssistThrottleResult {
  const { records, surface, now } = params;
  const nowTs = now.getTime();
  const relevant = records
    .slice(0, MAX_RECORDS)
    .filter((record) => extractSurface(record) === surface)
    .map((record) => ({ record, signalAt: extractSignalTime(record) }))
    .filter(({ signalAt }) => signalAt.getTime() <= nowTs);

  const recentRejects = relevant.filter(
    ({ record, signalAt }) =>
      record.status === "rejected" &&
      nowTs - signalAt.getTime() <= REJECT_WINDOW_MS,
  );
  const quickReverts = relevant.filter(
    ({ signalAt, record }) =>
      nowTs - signalAt.getTime() <= QUICK_REVERT_LOOKBACK_MS &&
      isQuickRevert(record, signalAt),
  );

  const latestRejectAt = recentRejects.reduce<number>(
    (latest, item) => Math.max(latest, item.signalAt.getTime()),
    0,
  );
  const latestQuickRevertAt = quickReverts.reduce<number>(
    (latest, item) => Math.max(latest, item.signalAt.getTime()),
    0,
  );
  const latestNegativeAt = Math.max(latestRejectAt, latestQuickRevertAt);

  const recoveryAccepts =
    latestNegativeAt > 0
      ? relevant.filter(
          ({ record, signalAt }) =>
            record.status === "accepted" &&
            signalAt.getTime() > latestNegativeAt &&
            signalAt.getTime() <= nowTs,
        ).length
      : 0;
  if (recoveryAccepts >= RECOVERY_ACCEPT_THRESHOLD) {
    return {
      throttled: false,
      reason: null,
      throttleUntil: null,
    };
  }

  const quickRevertThresholdReached =
    quickReverts.length >= QUICK_REVERT_THRESHOLD;
  const rejectThresholdReached = recentRejects.length >= REJECT_THRESHOLD;
  if (!quickRevertThresholdReached && !rejectThresholdReached) {
    return {
      throttled: false,
      reason: null,
      throttleUntil: null,
    };
  }

  if (quickRevertThresholdReached) {
    const throttleUntil = new Date(
      latestQuickRevertAt + QUICK_REVERT_THROTTLE_MS,
    );
    return {
      throttled: throttleUntil.getTime() > nowTs,
      reason: "quick_revert_burst",
      throttleUntil,
    };
  }

  const throttleUntil = new Date(latestRejectAt + REJECT_THROTTLE_MS);
  return {
    throttled: throttleUntil.getTime() > nowTs,
    reason: "reject_burst",
    throttleUntil,
  };
}
