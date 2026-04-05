import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CardBack } from "./CardBack";
import type { PanelProvenance } from "../../types/focusBrief";

describe("CardBack", () => {
  it("renders AI provenance with model info", () => {
    const provenance: PanelProvenance = {
      source: "ai",
      model: "claude-sonnet-4-6",
      temperature: 0.3,
      maxTokens: 1500,
      generatedAt: "2026-04-05T08:30:00Z",
      cacheStatus: "fresh",
      cacheExpiresAt: "2026-04-05T12:30:00Z",
      inputSummary: "40 open tasks, 8 projects",
      promptIntent: "Identify urgent items and pick one impactful task.",
    };
    render(<CardBack provenance={provenance} reason="Pinned — always visible" />);
    expect(screen.getByText("AI-generated")).toBeInTheDocument();
    expect(screen.getByText("claude-sonnet-4-6")).toBeInTheDocument();
    expect(screen.getByText("0.3")).toBeInTheDocument();
    expect(screen.getByText("40 open tasks, 8 projects")).toBeInTheDocument();
  });

  it("renders deterministic provenance with filter info", () => {
    const provenance: PanelProvenance = {
      source: "deterministic",
      method: "Database query + date math",
      freshness: "Computed on page load — real-time",
      filter: "dueDate within 3 days",
      dataBreakdown: "Overdue (2) · Today (1)",
      itemsShown: "3 of 3",
      logic: "Tasks grouped by days until due.",
    };
    render(<CardBack provenance={provenance} reason="5 tasks due soon" />);
    expect(screen.getByText("Deterministic")).toBeInTheDocument();
    expect(screen.getByText("Database query + date math")).toBeInTheDocument();
    expect(screen.getByText("dueDate within 3 days")).toBeInTheDocument();
  });

  it("renders ranking reason", () => {
    const provenance: PanelProvenance = { source: "deterministic" };
    render(<CardBack provenance={provenance} reason="3 items need triaging" />);
    expect(screen.getByText("3 items need triaging")).toBeInTheDocument();
  });

  it("renders pixel art when provided", () => {
    const provenance: PanelProvenance = { source: "ai" };
    render(
      <CardBack provenance={provenance} reason="test" pixelArt={<svg data-testid="art" />} />,
    );
    expect(screen.getByTestId("art")).toBeInTheDocument();
  });
});
