// =============================================================================
// recurrence.js — Next-occurrence calculator for recurring tasks.
// Pure date math, no side effects. Used by todosService and drawerUi.
// =============================================================================

/**
 * Compute the next occurrence date for a recurring task.
 *
 * Anchors to the task's current due date (or today if none). For "every N
 * weeks" this means the interval is measured from the due date, not from when
 * the user clicks complete. This avoids drift and matches Things 3 behavior.
 *
 * Monthly edge case: if the day doesn't exist in the target month (e.g.,
 * Jan 31 + 1 month = Feb 28/29), we clamp to the last day of the month.
 *
 * @param {string} recurrenceType  "daily" | "weekly" | "monthly" | "yearly"
 * @param {number} interval        How many units between occurrences (default 1)
 * @param {string|Date|null} currentDueDate  The task's current due date
 * @returns {Date|null}  The next occurrence, or null if no recurrence
 */
export function computeNextOccurrence(
  recurrenceType,
  interval = 1,
  currentDueDate = null,
) {
  if (
    !recurrenceType ||
    recurrenceType === "none" ||
    recurrenceType === "rrule"
  )
    return null;

  const n = Math.max(1, Math.round(interval) || 1);
  const anchor = currentDueDate ? new Date(currentDueDate) : new Date();

  if (Number.isNaN(anchor.getTime())) return null;

  switch (recurrenceType) {
    case "daily":
      anchor.setDate(anchor.getDate() + n);
      break;
    case "weekly":
      anchor.setDate(anchor.getDate() + n * 7);
      break;
    case "monthly": {
      const origDay = anchor.getDate();
      anchor.setMonth(anchor.getMonth() + n);
      // Clamp: if the month rolled over (e.g. Jan 31 → Mar 3), go to last day
      if (anchor.getDate() < origDay) {
        anchor.setDate(0); // last day of previous month
      }
      break;
    }
    case "yearly": {
      const origDay = anchor.getDate();
      anchor.setFullYear(anchor.getFullYear() + n);
      if (anchor.getDate() < origDay) {
        anchor.setDate(0);
      }
      break;
    }
    default:
      return null;
  }

  return anchor;
}

/**
 * Build recurrence label for display.
 * @param {string} type
 * @param {number} interval
 * @returns {string}  e.g. "Every day", "Every 2 weeks", "Monthly"
 */
export function recurrenceLabel(type, interval = 1) {
  if (!type || type === "none") return "";
  const n = interval || 1;
  const units = {
    daily: "day",
    weekly: "week",
    monthly: "month",
    yearly: "year",
  };
  const unit = units[type];
  if (!unit) return type;
  if (n === 1) return `Every ${unit}`;
  return `Every ${n} ${unit}s`;
}
