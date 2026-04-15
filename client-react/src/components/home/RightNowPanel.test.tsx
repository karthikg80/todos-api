// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { RightNowPanel } from "./RightNowPanel";

// Mock dependencies
vi.mock("./FlipCard", () => ({
  FlipCard: ({ front, back }: any) =>
    React.createElement("div", { "data-testid": "flip-card" },
      React.createElement("div", { "data-testid": "flip-front" }, front),
      React.createElement("div", { "data-testid": "flip-back" }, back),
    ),
}));

vi.mock("./TarotCard", () => ({
  TarotCardFront: ({ children, name }: any) =>
    React.createElement("div", { "data-testid": "tarot-front", "data-name": name }, children),
  TarotCardBack: ({ children, name }: any) =>
    React.createElement("div", { "data-testid": "tarot-back", "data-name": name }, children),
}));

vi.mock("./CardBack", () => ({
  CardBackContent: () => React.createElement("div", { "data-testid": "card-back-content" }),
}));

vi.mock("./pixel-art", () => ({
  FlameArt: ({ size }: any) => React.createElement("div", { "data-testid": "flame-art", "data-size": size }),
}));

vi.mock("../../agents/useAgentProfiles", () => ({
  useAgentProfiles: () => [],
  getAgentProfile: () => null,
}));

const createMockData = (overrides: any = {}) => ({
  narrative: overrides.narrative ?? "Test narrative",
  urgentItems: overrides.urgentItems ?? [],
  topRecommendation: overrides.topRecommendation ?? null,
  agentId: overrides.agentId ?? null,
});

describe("RightNowPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    data: createMockData(),
    provenance: undefined,
    onTaskClick: vi.fn(),
  };

  describe("rendering conditions", () => {
    it("renders when narrative is present", () => {
      render(React.createElement(RightNowPanel, defaultProps));
      expect(screen.getByTestId("flip-card")).toBeTruthy();
    });

    it("renders when urgent items are present", () => {
      render(
        React.createElement(RightNowPanel, {
          ...defaultProps,
          data: createMockData({ narrative: null, urgentItems: [{ id: "t1", title: "Urgent" }] }),
        }),
      );
      expect(screen.getByTestId("flip-card")).toBeTruthy();
    });

    it("renders when topRecommendation is present", () => {
      render(
        React.createElement(RightNowPanel, {
          ...defaultProps,
          data: createMockData({
            narrative: null,
            topRecommendation: { taskId: "t1", title: "Rec", reasoning: "Why" },
          }),
        }),
      );
      expect(screen.getByTestId("flip-card")).toBeTruthy();
    });
  });

  describe("content rendering", () => {
    it("renders narrative text when present", () => {
      render(React.createElement(RightNowPanel, defaultProps));
      expect(screen.getByText("Test narrative")).toBeTruthy();
    });

    it("renders top recommendation button when present", () => {
      render(
        React.createElement(RightNowPanel, {
          ...defaultProps,
          data: createMockData({
            topRecommendation: { taskId: "t1", title: "Top task", reasoning: "Important" },
          }),
        }),
      );
      expect(screen.getByText("Strongest action")).toBeTruthy();
      expect(screen.getByText("Top task")).toBeTruthy();
      expect(screen.getByText("Important")).toBeTruthy();
    });

    it("calls onTaskClick when recommendation button is clicked", () => {
      const onTaskClick = vi.fn();
      render(
        React.createElement(RightNowPanel, {
          ...defaultProps,
          data: createMockData({
            topRecommendation: { taskId: "t1", title: "Top task", reasoning: "Important" },
          }),
          onTaskClick,
        }),
      );
      fireEvent.click(screen.getByText("Strongest action"));
      expect(onTaskClick).toHaveBeenCalledWith("t1");
    });
  });

  describe("flip card structure", () => {
    it("renders both front and back of flip card", () => {
      render(React.createElement(RightNowPanel, defaultProps));
      expect(screen.getByTestId("flip-front")).toBeTruthy();
      expect(screen.getByTestId("flip-back")).toBeTruthy();
    });

    it("renders tarot card front with correct name", () => {
      render(React.createElement(RightNowPanel, defaultProps));
      expect(screen.getByTestId("tarot-front").getAttribute("data-name")).toBe("The Flame");
    });

    it("renders tarot card back with correct name", () => {
      render(React.createElement(RightNowPanel, defaultProps));
      expect(screen.getByTestId("tarot-back").getAttribute("data-name")).toBe("The Flame");
    });

    it("renders card back content", () => {
      render(React.createElement(RightNowPanel, defaultProps));
      expect(screen.getByTestId("card-back-content")).toBeTruthy();
    });
  });
});
