// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { OnboardingFlow } from "./OnboardingFlow";

// Mock API calls
vi.mock("../../api/client", () => ({
  apiCall: vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })),
}));

// Mock AuthProvider
vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "1", email: "test@example.com", name: "Test", onboardingStep: 1, onboardingCompletedAt: null },
    setUser: vi.fn(),
  }),
}));

describe("OnboardingFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the onboarding component", () => {
    const { container } = render(
      createElement(OnboardingFlow, {
        onComplete: vi.fn(),
        onAddTodo: vi.fn().mockResolvedValue(undefined),
      }),
    );
    // Should render something (even if just loading state)
    expect(container.firstChild).toBeTruthy();
  });
});
