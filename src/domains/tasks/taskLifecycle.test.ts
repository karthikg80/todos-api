import {
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
import { TaskStatus } from "../../types";

describe("taskLifecycle", () => {
  describe("isValidTransition", () => {
    it("allows no-op transitions (same state)", () => {
      for (const status of ALL_STATUSES) {
        expect(isValidTransition(status, status)).toBe(true);
      }
    });

    it("allows inbox → next", () => {
      expect(isValidTransition("inbox", "next")).toBe(true);
    });

    it("allows inbox → scheduled", () => {
      expect(isValidTransition("inbox", "scheduled")).toBe(true);
    });

    it("allows inbox → done", () => {
      expect(isValidTransition("inbox", "done")).toBe(true);
    });

    it("allows next → in_progress", () => {
      expect(isValidTransition("next", "in_progress")).toBe(true);
    });

    it("allows next → done", () => {
      expect(isValidTransition("next", "done")).toBe(true);
    });

    it("allows in_progress → done", () => {
      expect(isValidTransition("in_progress", "done")).toBe(true);
    });

    it("allows in_progress → waiting", () => {
      expect(isValidTransition("in_progress", "waiting")).toBe(true);
    });

    it("allows done → next (reopen)", () => {
      expect(isValidTransition("done", "next")).toBe(true);
    });

    it("allows cancelled → inbox (resurrect)", () => {
      expect(isValidTransition("cancelled", "inbox")).toBe(true);
    });

    it("blocks done → in_progress (must reopen first)", () => {
      expect(isValidTransition("done", "in_progress")).toBe(false);
    });

    it("blocks done → scheduled", () => {
      expect(isValidTransition("done", "scheduled")).toBe(false);
    });

    it("blocks cancelled → done (must resurrect first)", () => {
      expect(isValidTransition("cancelled", "done")).toBe(false);
    });

    it("blocks in_progress → someday (must deactivate first)", () => {
      expect(isValidTransition("in_progress", "someday")).toBe(false);
    });
  });

  describe("availableTransitions", () => {
    it("returns all valid targets from inbox", () => {
      const targets = availableTransitions("inbox");
      expect(targets).toContain("next");
      expect(targets).toContain("scheduled");
      expect(targets).toContain("done");
      expect(targets).toContain("cancelled");
    });

    it("returns limited targets from done", () => {
      const targets = availableTransitions("done");
      expect(targets).toEqual(expect.arrayContaining(["next", "inbox"]));
      expect(targets).not.toContain("in_progress");
      expect(targets).not.toContain("scheduled");
    });

    it("returns limited targets from cancelled", () => {
      const targets = availableTransitions("cancelled");
      expect(targets).toEqual(expect.arrayContaining(["inbox", "next"]));
      expect(targets).not.toContain("done");
    });
  });

  describe("classifyStatus", () => {
    it("classifies inbox as open, not terminal/active/blocked", () => {
      expect(classifyStatus("inbox")).toEqual({
        isOpen: true,
        isTerminal: false,
        isActive: false,
        isBlocked: false,
      });
    });

    it("classifies next as open and active", () => {
      const c = classifyStatus("next");
      expect(c.isOpen).toBe(true);
      expect(c.isActive).toBe(true);
      expect(c.isTerminal).toBe(false);
    });

    it("classifies in_progress as open and active", () => {
      const c = classifyStatus("in_progress");
      expect(c.isOpen).toBe(true);
      expect(c.isActive).toBe(true);
    });

    it("classifies waiting as open and blocked", () => {
      const c = classifyStatus("waiting");
      expect(c.isOpen).toBe(true);
      expect(c.isBlocked).toBe(true);
      expect(c.isActive).toBe(false);
    });

    it("classifies someday as open and blocked", () => {
      const c = classifyStatus("someday");
      expect(c.isOpen).toBe(true);
      expect(c.isBlocked).toBe(true);
    });

    it("classifies done as terminal", () => {
      expect(classifyStatus("done")).toEqual({
        isOpen: false,
        isTerminal: true,
        isActive: false,
        isBlocked: false,
      });
    });

    it("classifies cancelled as terminal", () => {
      expect(classifyStatus("cancelled")).toEqual({
        isOpen: false,
        isTerminal: true,
        isActive: false,
        isBlocked: false,
      });
    });
  });

  describe("reconcileStatusAndCompletion", () => {
    it("defaults to next/false when no inputs", () => {
      const result = reconcileStatusAndCompletion({});
      expect(result.status).toBe("next");
      expect(result.completed).toBe(false);
      expect(result.completedAt).toBeNull();
    });

    it("sets status=done and completedAt when completed=true", () => {
      const result = reconcileStatusAndCompletion({
        nextCompleted: true,
      });
      expect(result.status).toBe("done");
      expect(result.completed).toBe(true);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it("preserves existing completedAt when re-completing", () => {
      const existing = new Date("2024-01-01");
      const result = reconcileStatusAndCompletion({
        currentCompleted: true,
        currentCompletedAt: existing,
        nextCompleted: true,
      });
      expect(result.completedAt).toBe(existing);
    });

    it("reverts to previous status when un-completing", () => {
      const result = reconcileStatusAndCompletion({
        currentStatus: "in_progress",
        currentCompleted: true,
        currentCompletedAt: new Date(),
        nextCompleted: false,
      });
      expect(result.status).toBe("in_progress");
      expect(result.completed).toBe(false);
      expect(result.completedAt).toBeNull();
    });

    it("defaults to next when un-completing from done with no prior status", () => {
      const result = reconcileStatusAndCompletion({
        currentStatus: "done",
        currentCompleted: true,
        nextCompleted: false,
      });
      expect(result.status).toBe("next");
    });

    it("setting non-done status forces completed=false", () => {
      const result = reconcileStatusAndCompletion({
        currentStatus: "done",
        currentCompleted: true,
        nextStatus: "next",
      });
      expect(result.status).toBe("next");
      expect(result.completed).toBe(false);
      expect(result.completedAt).toBeNull();
    });

    it("setting status=done forces completed=true", () => {
      const result = reconcileStatusAndCompletion({
        currentStatus: "next",
        currentCompleted: false,
        nextStatus: "done",
        nextCompleted: true,
      });
      expect(result.status).toBe("done");
      expect(result.completed).toBe(true);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it("completed=true overrides explicit non-done status", () => {
      const result = reconcileStatusAndCompletion({
        nextStatus: "next",
        nextCompleted: true,
      });
      expect(result.status).toBe("done");
      expect(result.completed).toBe(true);
    });
  });

  describe("deriveStatusFromLegacyFields", () => {
    it("returns existing status if valid", () => {
      expect(
        deriveStatusFromLegacyFields({
          completed: false,
          status: "in_progress",
        }),
      ).toBe("in_progress");
    });

    it("returns done for completed tasks", () => {
      expect(deriveStatusFromLegacyFields({ completed: true })).toBe("done");
    });

    it("returns waiting when waitingOn is set", () => {
      expect(
        deriveStatusFromLegacyFields({
          completed: false,
          waitingOn: "John",
        }),
      ).toBe("waiting");
    });

    it("returns scheduled when scheduledDate is set", () => {
      expect(
        deriveStatusFromLegacyFields({
          completed: false,
          scheduledDate: new Date(),
        }),
      ).toBe("scheduled");
    });

    it("returns inbox as default for uncategorized tasks", () => {
      expect(deriveStatusFromLegacyFields({ completed: false })).toBe("inbox");
    });

    it("prioritizes completed over other signals", () => {
      expect(
        deriveStatusFromLegacyFields({
          completed: true,
          waitingOn: "someone",
          scheduledDate: new Date(),
        }),
      ).toBe("done");
    });
  });

  describe("status sets are exhaustive", () => {
    it("ALL_STATUSES covers every TaskStatus", () => {
      expect(ALL_STATUSES.length).toBe(8);
    });

    it("OPEN + TERMINAL = ALL", () => {
      const combined = [...OPEN_STATUSES, ...TERMINAL_STATUSES];
      expect(combined.sort()).toEqual([...ALL_STATUSES].sort());
    });

    it("ACTIVE + BLOCKED are subsets of OPEN", () => {
      for (const s of ACTIVE_STATUSES) {
        expect(OPEN_STATUSES).toContain(s);
      }
      for (const s of BLOCKED_STATUSES) {
        expect(OPEN_STATUSES).toContain(s);
      }
    });

    it("every status has a transition entry", () => {
      for (const status of ALL_STATUSES) {
        expect(availableTransitions(status)).toBeDefined();
        expect(availableTransitions(status).length).toBeGreaterThan(0);
      }
    });
  });
});
