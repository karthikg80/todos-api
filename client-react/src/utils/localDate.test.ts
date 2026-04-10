// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { toLocalDateString, tomorrowLocal } from "./localDate";

describe("localDate", () => {
  describe("toLocalDateString", () => {
    it("formats a date as YYYY-MM-DD", () => {
      const date = new Date(2026, 3, 10); // April 10, 2026
      expect(toLocalDateString(date)).toBe("2026-04-10");
    });

    it("pads single-digit months and days", () => {
      const date = new Date(2026, 0, 5); // January 5, 2026
      expect(toLocalDateString(date)).toBe("2026-01-05");
    });

    it("uses local date, not UTC", () => {
      // Create a date that might be different in UTC vs local
      const date = new Date(2026, 11, 31, 23, 0, 0); // Dec 31, 2026 11pm local
      const result = toLocalDateString(date);
      // Should be Dec 31 in local time, not Jan 1 in UTC
      expect(result).toBe("2026-12-31");
    });
  });

  describe("tomorrowLocal", () => {
    it("returns tomorrow's date as YYYY-MM-DD", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expected = toLocalDateString(tomorrow);
      expect(tomorrowLocal()).toBe(expected);
    });

    it("handles month rollover correctly", () => {
      const RealDate = globalThis.Date;
      const mockNow = new RealDate(2026, 0, 31); // Jan 31

      vi.useFakeTimers();
      vi.setSystemTime(mockNow);

      const result = tomorrowLocal();
      expect(result).toBe("2026-02-01");

      vi.useRealTimers();
    });
  });
});
