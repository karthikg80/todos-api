// @vitest-environment jsdom
import React from "react";
import { ce } from "../../test-helpers";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AgentProfile } from "../../agents/types";
import type { RightNow } from "../../types/focusBrief";
import { RightNowPanel } from "./RightNowPanel";
import { useAgentProfiles } from "../../agents/useAgentProfiles";

vi.mock("./FlipCard", () => ({
  FlipCard: ({ front }: { front: React.ReactNode }) => (
    <div data-testid="flip-mock">{front}</div>
  ),
}));

vi.mock("./TarotCard", () => ({
  TarotCardFront: ({ children, agent }: { children?: React.ReactNode; agent?: { name: string } }) => (
    <div data-testid="tarot-front">
      {agent ? <span data-testid="agent-name">{agent.name}</span> : null}
      {children}
    </div>
  ),
  TarotCardBack: () => <div data-testid="tarot-back" />,
}));

vi.mock("./CardBack", () => ({
  CardBackContent: () => <div data-testid="card-back" />,
}));

vi.mock("./pixel-art", () => ({
  FlameArt: () => <span data-testid="flame-art" />,
}));

vi.mock("../../agents/useAgentProfiles", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../agents/useAgentProfiles")>();
  return {
    ...actual,
    useAgentProfiles: vi.fn(actual.useAgentProfiles),
  };
});

const mira: AgentProfile = {
  id: "mira",
  name: "Mira",
  role: "Planner",
  traits: ["t1", "t2", "t3"],
  quote: "q",
  superpower: "sp",
  quirk: "qk",
  bestCalledWhen: "planning",
  colors: {
    stroke: "#000",
    bg: "#fff",
    textDark: "#222",
    traitBg: "#eee",
  },
  voice: {
    tone: "warm",
    avgWordsPerSentence: 6,
    openers: ["o"],
    closers: ["c"],
    thinkingLines: ["th"],
    emptyStateLines: ["e"],
    errorLines: ["er"],
  },
  avatarSeed: 2,
};

describe("RightNowPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there is nothing to show", () => {
    const { container } = render(
      ce(RightNowPanel, {
        data: {
          narrative: "",
          urgentItems: [],
          topRecommendation: null,
        },
        onTaskClick: vi.fn(),
      }),
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders when urgent items exist even if narrative is empty", () => {
    vi.mocked(useAgentProfiles).mockReturnValue({});
    const data: RightNow = {
      narrative: "",
      urgentItems: [
        { title: "Urgent", dueDate: "2024-01-01", reason: "soon" },
      ],
      topRecommendation: null,
    };
    render(ce(RightNowPanel, { data, onTaskClick: vi.fn() }));
    expect(screen.getByTestId("flip-mock")).toBeTruthy();
  });

  it("renders narrative, recommendation click, and agent chip when profile exists", () => {
    vi.mocked(useAgentProfiles).mockReturnValue({ mira });
    const onTaskClick = vi.fn();
    const data: RightNow = {
      narrative: "You should focus.",
      urgentItems: [],
      topRecommendation: {
        title: "Ship feature",
        taskId: "task-99",
        reasoning: "Highest leverage.",
      },
      agentId: "mira",
    };
    render(ce(RightNowPanel, { data, onTaskClick }));
    expect(screen.getByText("You should focus.")).toBeTruthy();
    expect(screen.getByTestId("agent-name").textContent).toBe("Mira");
    fireEvent.click(screen.getByRole("button", { name: /Ship feature/i }));
    expect(onTaskClick).toHaveBeenCalledWith("task-99");
  });
});
