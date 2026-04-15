// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { AgentProfile } from "../types";
import { AgentMessage } from "./AgentMessage";
import { getThinkingLine } from "../voiceEngine";

vi.mock("./AgentBadge", () => ({
  AgentBadge: ({ mode }: { mode: string }) => (
    <span data-testid="agent-badge" data-mode={mode} />
  ),
}));

vi.mock("../voiceEngine", () => ({
  getThinkingLine: vi.fn(),
}));

const agent: AgentProfile = {
  id: "orla",
  name: "Orla",
  role: "Guide",
  traits: ["a", "b", "c"],
  quote: "q",
  superpower: "s",
  quirk: "k",
  bestCalledWhen: "now",
  colors: {
    stroke: "#112233",
    bg: "#aabbcc",
    textDark: "#010101",
    traitBg: "#eeeeee",
  },
  voice: {
    tone: "warm",
    avgWordsPerSentence: 8,
    openers: ["hi"],
    closers: ["bye"],
    thinkingLines: ["t1", "t2"],
    emptyStateLines: ["e"],
    errorLines: ["err"],
  },
  avatarSeed: 1,
};

describe("AgentMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getThinkingLine).mockReturnValue("thinking-mock");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders idle content and badge mode idle", () => {
    render(
      ce(AgentMessage, {
        agent,
        content: "Hello from agent",
        isStreaming: false,
      }),
    );
    expect(screen.getByText("Hello from agent")).toBeTruthy();
    expect(screen.getByTestId("agent-badge").getAttribute("data-mode")).toBe(
      "idle",
    );
  });

  it("renders streaming thinking text and badge mode thinking", () => {
    render(
      ce(AgentMessage, {
        agent,
        content: "ignored while streaming",
        isStreaming: true,
      }),
    );
    expect(screen.getByText("thinking-mock")).toBeTruthy();
    expect(screen.getByTestId("agent-badge").getAttribute("data-mode")).toBe(
      "thinking",
    );
  });

  it("shows formatted timestamp when provided", () => {
    const spy = vi
      .spyOn(Date.prototype, "toLocaleTimeString")
      .mockReturnValue("9:30 AM");
    render(
      ce(AgentMessage, {
        agent,
        content: "x",
        timestamp: new Date("2020-01-01T00:00:00.000Z"),
      }),
    );
    expect(screen.getByText("9:30 AM")).toBeTruthy();
    spy.mockRestore();
  });

  it("refreshes thinking line on interval while streaming", () => {
    const mockFn = vi.mocked(getThinkingLine);
    let tick = 0;
    mockFn.mockImplementation(() => `thinking-${tick++}`);

    vi.useFakeTimers();
    render(
      ce(AgentMessage, {
        agent,
        content: "body",
        isStreaming: true,
      }),
    );

    expect(screen.getByText("thinking-0")).toBeTruthy();
    const callsAfterMount = mockFn.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(mockFn.mock.calls.length).toBeGreaterThan(callsAfterMount);
    expect(screen.getByText("thinking-1")).toBeTruthy();
  });
});
