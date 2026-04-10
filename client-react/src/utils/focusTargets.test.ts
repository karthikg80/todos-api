// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as focusTargetsModule from "./focusTargets";

// The focusTargets module checks getClientRects().length > 0 for visibility,
// which doesn't work in jsdom. We need to mock getClientRects.
function makeElementVisible(el: HTMLElement) {
  vi.spyOn(el, "getClientRects").mockReturnValue([{ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON: () => ({}) } as DOMRect]);
  return el;
}

function createInput(attrs: Record<string, string> = {}) {
  const input = document.createElement("input");
  Object.entries(attrs).forEach(([key, value]) => {
    input.setAttribute(key, value);
  });
  document.body.appendChild(input);
  return input;
}

function createButton(attrs: Record<string, string> = {}) {
  const button = document.createElement("button");
  Object.entries(attrs).forEach(([key, value]) => {
    button.setAttribute(key, value);
  });
  document.body.appendChild(button);
  return button;
}

describe("focusTargets", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  describe("focusGlobalSearchInput", () => {
    it("focuses and selects the global search input when visible", () => {
      const input = createInput({ "data-global-search-input": "true" });
      makeElementVisible(input);
      const focusSpy = vi.spyOn(input, "focus");
      const selectSpy = vi.spyOn(input, "select");

      const result = focusTargetsModule.focusGlobalSearchInput();
      expect(result).toBe(true);
      expect(focusSpy).toHaveBeenCalled();
      expect(selectSpy).toHaveBeenCalled();
    });

    it("returns false when no global search input exists", () => {
      const result = focusTargetsModule.focusGlobalSearchInput();
      expect(result).toBe(false);
    });

    it("ignores hidden inputs", () => {
      const input = createInput({ "data-global-search-input": "true", hidden: "" });
      const result = focusTargetsModule.focusGlobalSearchInput();
      expect(result).toBe(false);
    });
  });

  describe("focusQuickEntryInput", () => {
    it("focuses the quick entry input when visible", () => {
      const input = createInput({ "data-quick-entry-input": "true" });
      makeElementVisible(input);
      const focusSpy = vi.spyOn(input, "focus");

      const result = focusTargetsModule.focusQuickEntryInput();
      expect(result).toBe(true);
      expect(focusSpy).toHaveBeenCalled();
    });

    it("returns false when no quick entry input exists", () => {
      const result = focusTargetsModule.focusQuickEntryInput();
      expect(result).toBe(false);
    });
  });

  describe("triggerPrimaryNewTask", () => {
    it("focuses quick entry if available", () => {
      const input = createInput({ "data-quick-entry-input": "true" });
      makeElementVisible(input);
      const focusSpy = vi.spyOn(input, "focus");

      const result = focusTargetsModule.triggerPrimaryNewTask();
      expect(result).toBe(true);
      expect(focusSpy).toHaveBeenCalled();
    });

    it("clicks new task trigger when quick entry not available", () => {
      const button = createButton({ "data-new-task-trigger": "true" });
      makeElementVisible(button);
      const clickSpy = vi.spyOn(button, "click");

      const result = focusTargetsModule.triggerPrimaryNewTask();
      expect(result).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });

    it("returns false when neither quick entry nor trigger exists", () => {
      const result = focusTargetsModule.triggerPrimaryNewTask();
      expect(result).toBe(false);
    });
  });
});
