import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CardBackContent } from "./CardBack";
import type { PanelProvenance } from "../../types/focusBrief";

describe("CardBackContent", () => {
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
    render(<CardBackContent provenance={provenance} reason="Pinned — always visible" />);
    expect(screen.getByText("Divined by")).toBeInTheDocument();
    expect(screen.getByText("claude-sonnet-4-6")).toBeInTheDocument();
    expect(
      screen.getByText(/temp 0\.3.*1500 tokens.*40 open tasks/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/"Identify urgent items and pick one impactful task\."/),
    ).toBeInTheDocument();
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
    render(<CardBackContent provenance={provenance} reason="5 tasks due soon" />);
    expect(screen.getByText("Computed by")).toBeInTheDocument();
    expect(screen.getByText("Database query + date math")).toBeInTheDocument();
    expect(screen.getByText("dueDate within 3 days")).toBeInTheDocument();
  });

  it("renders surfaced-because reason for deterministic", () => {
    const provenance: PanelProvenance = { source: "deterministic" };
    render(<CardBackContent provenance={provenance} reason="3 items need triaging" />);
    expect(screen.getByText(/"3 items need triaging"/)).toBeInTheDocument();
  });

  it("renders source unknown when no provenance", () => {
    render(<CardBackContent reason="test reason" />);
    expect(screen.getByText("Source unknown")).toBeInTheDocument();
    expect(screen.getByText("test reason")).toBeInTheDocument();
  });
});
