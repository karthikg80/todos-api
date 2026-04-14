// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { OnboardingFlow } from "./OnboardingFlow";
import * as apiClient from "../../api/client";
import { mockResponse } from "../../test-helpers";

vi.mock("../../api/client", () => ({
  apiCall: vi.fn(),
}));

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../../auth/AuthProvider";

const mockUseAuth = vi.mocked(useAuth);
const mockApiCall = vi.mocked(apiClient.apiCall);

function setupAuth(overrides: {
  user?: any;
  setUser?: ReturnType<typeof vi.fn>;
} = {}) {
  mockUseAuth.mockReturnValue({
    user: overrides.user ?? {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      onboardingStep: 1,
      onboardingCompletedAt: null,
    },
    setUser: (overrides.setUser ?? vi.fn()) as (user: any) => void,
    logout: vi.fn(),
    loading: false,
    setTokens: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(null),
  });
}

const defaultProps = {
  onComplete: vi.fn(),
  onAddTodo: vi.fn().mockResolvedValue({ id: "t1" }),
};

describe("OnboardingFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiCall.mockResolvedValue(mockResponse({ body: { soulProfile: {} } }));
    setupAuth();
  });

  describe("rendering conditions", () => {
    it("returns null when onboarding is already completed", () => {
      setupAuth({
        user: {
          id: "u1",
          name: "Test User",
          email: "test@example.com",
          onboardingStep: 4,
          onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
        },
      });
      const { container } = render(React.createElement(OnboardingFlow, defaultProps));
      expect(container.firstChild).toBeNull();
    });

    it("calls onComplete when onboarding is already completed", async () => {
      const onComplete = vi.fn();
      setupAuth({
        user: {
          id: "u1",
          name: "Test User",
          email: "test@example.com",
          onboardingStep: 4,
          onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
        },
      });
      render(React.createElement(OnboardingFlow, { ...defaultProps, onComplete }));
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });
    });
  });

  describe("loading state", () => {
    it("shows loading message while preferences are loading", () => {
      // Return a pending promise to keep loading state active
      mockApiCall.mockReturnValue(new Promise<Response>(() => {}));
      render(React.createElement(OnboardingFlow, defaultProps));
      expect(screen.getByText("Loading onboarding")).toBeTruthy();
      expect(screen.getByText("Reading your current preferences.")).toBeTruthy();
    });
  });

  describe("step 1 — life areas and tone", () => {
    it("renders step 1 title and description", async () => {
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      expect(screen.getByText("A calmer start")).toBeTruthy();
      expect(screen.getByText("Set tone first, then get to a usable workspace quickly.")).toBeTruthy();
    });

    it("renders life area chips", async () => {
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      expect(screen.getByText("Work")).toBeTruthy();
      expect(screen.getByText("Personal")).toBeTruthy();
      expect(screen.getByText("Family / caregiving")).toBeTruthy();
      expect(screen.getByText("Health")).toBeTruthy();
      expect(screen.getByText("Side projects")).toBeTruthy();
    });

    it("renders tone options", async () => {
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      expect(screen.getByText("Calm")).toBeTruthy();
      expect(screen.getByText("Focused")).toBeTruthy();
      expect(screen.getByText("Encouraging")).toBeTruthy();
      expect(screen.getByText("Direct")).toBeTruthy();
    });

    it("shows Continue and Skip buttons on step 1", async () => {
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Skip for now" })).toBeTruthy();
    });

    it("toggles life area selection", async () => {
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      const workChip = screen.getByText("Work");
      expect(workChip).not.toHaveClass("onboarding-chip--selected");
      await act(async () => {
        fireEvent.click(workChip);
      });
      expect(workChip).toHaveClass("onboarding-chip--selected");
      await act(async () => {
        fireEvent.click(workChip);
      });
      expect(workChip).not.toHaveClass("onboarding-chip--selected");
    });

    it("selects tone option", async () => {
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      const directBtn = screen.getByText("Direct");
      await act(async () => {
        fireEvent.click(directBtn);
      });
      expect(directBtn).toHaveClass("onboarding-choice-card--selected");
    });
  });

  describe("step 2 — planning preferences", () => {
    it("renders step 2 title", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 2, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      expect(screen.getByText("Tell us how planning usually gets hard")).toBeTruthy();
    });

    it("renders failure mode chips", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 2, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      expect(screen.getByText("Overwhelmed")).toBeTruthy();
      expect(screen.getByText("Forgetful")).toBeTruthy();
      expect(screen.getByText("Perfectionist")).toBeTruthy();
    });

    it("renders planning style, energy pattern, and daily ritual sections", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 2, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      // Step 2 renders ChoiceGroup components for these sections
      expect(screen.getByText("Planning style")).toBeTruthy();
      expect(screen.getByText("Energy pattern")).toBeTruthy();
      expect(screen.getByText("Daily ritual")).toBeTruthy();
    });

    it("shows Back and Keep going buttons on step 2", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 2, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      expect(screen.getByRole("button", { name: "Keep going" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    });
  });

  describe("step 3 — seed tasks", () => {
    it("renders step 3 title", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 3, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      expect(screen.getByText("Start with a few gentle examples")).toBeTruthy();
    });

    it("renders seed task buttons", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 3, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      const addButtons = screen.getAllByRole("button", { name: /Add / });
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it("renders custom task input", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 3, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      expect(screen.getByPlaceholderText("What needs your attention?")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Add task" })).toBeTruthy();
    });

    it("adds a seed task when clicked", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 3, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      const addButtons = screen.getAllByRole("button", { name: /Add / });
      await act(async () => {
        fireEvent.click(addButtons[0]);
      });
      await waitFor(() => {
        expect(defaultProps.onAddTodo).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "next",
            priority: "medium",
            source: "system_seed",
          }),
        );
      });
    });

    it("adds a custom task when input is submitted", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 3, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      const input = screen.getByPlaceholderText("What needs your attention?");
      await act(async () => {
        fireEvent.change(input, { target: { value: "My custom task" } });
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Add task" }));
      });
      await waitFor(() => {
        expect(defaultProps.onAddTodo).toHaveBeenCalledWith(
          expect.objectContaining({ title: "My custom task" }),
        );
      });
    });

    it("adds custom task on Enter key", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 3, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      const input = screen.getByPlaceholderText("What needs your attention?");
      await act(async () => {
        fireEvent.change(input, { target: { value: "Enter task" } });
        fireEvent.keyDown(input, { key: "Enter" });
      });
      await waitFor(() => {
        expect(defaultProps.onAddTodo).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Enter task" }),
        );
      });
    });

    it("shows Back and Continue buttons on step 3", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 3, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    });
  });

  describe("step 4 — daily brief preview", () => {
    it("renders step 4 title", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 4, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      expect(screen.getByText("Your Focus view stays small on purpose")).toBeTruthy();
    });

    it("renders preview cards", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 4, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      expect(screen.getByText("Today's focus")).toBeTruthy();
      expect(screen.getByText("Rescue mode")).toBeTruthy();
    });

    it("shows Back and Open my workspace buttons on step 4", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 4, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      expect(screen.getByRole("button", { name: "Open my workspace" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    });
  });

  describe("navigation", () => {
    it("advances from step 1 to step 2 on Continue click", async () => {
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      });
      await waitFor(() => {
        expect(screen.getByText("Tell us how planning usually gets hard")).toBeTruthy();
      });
    });

    it("goes back from step 2 to step 1 on Back click", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 2, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Back" }));
      });
      await waitFor(() => {
        expect(screen.getByText("A calmer start")).toBeTruthy();
      });
    });

    it("completes onboarding on Skip click", async () => {
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
      });
      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled();
      });
    });

    it("completes onboarding on Open my workspace click", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 4, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Open my workspace" }));
      });
      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled();
      });
    });
  });

  describe("error handling", () => {
    it("shows error message when preferences load fails", async () => {
      mockApiCall.mockResolvedValueOnce(mockResponse({ ok: false }) as any);
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      await waitFor(() => {
        expect(screen.getByText("Could not load onboarding preferences.")).toBeTruthy();
      });
    });

    it("shows error message when step persistence fails", async () => {
      mockApiCall.mockImplementation(async (url: string) => {
        if (url.includes("/onboarding/step")) {
          return mockResponse({ ok: false }) as any;
        }
        return mockResponse({ body: { soulProfile: {} } });
      });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Failed to save onboarding step/)).toBeTruthy();
      });
    });
  });

  describe("progress indicator", () => {
    it("renders 4 progress dots", async () => {
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      const dots = document.querySelectorAll(".onboarding-card__dot");
      expect(dots.length).toBe(4);
    });

    it("marks current step as active", async () => {
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      const activeDots = document.querySelectorAll(".onboarding-card__dot--active");
      expect(activeDots.length).toBe(1);
    });

    it("marks completed steps as done", async () => {
      setupAuth({ user: { id: "u1", name: "Test", email: "t@t.com", onboardingStep: 3, onboardingCompletedAt: null } });
      await act(async () => {
        render(React.createElement(OnboardingFlow, defaultProps));
      });
      const doneDots = document.querySelectorAll(".onboarding-card__dot--done");
      expect(doneDots.length).toBe(2); // Steps 1 and 2
    });
  });
});
