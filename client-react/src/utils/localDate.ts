/**
 * Format a Date as a local YYYY-MM-DD string without UTC drift.
 * Unlike toISOString().split("T")[0], this uses the local calendar date.
 */
export function toLocalDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Get tomorrow's local date as YYYY-MM-DD. */
export function tomorrowLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateString(d);
}
