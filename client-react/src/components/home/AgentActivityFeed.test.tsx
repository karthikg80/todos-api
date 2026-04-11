// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AgentActivityFeed } from "./AgentActivityFeed";

const { createElement: ce } = React;

// Mock the API to return a never-resolving promise (simulates loading state)
vi.mock("../../api/client", () => ({
  apiCall: vi.fn(() => new Promise(() => {})),
}));

vi.mock("../../agents/useAgentProfiles", () => ({
  useAgentProfiles: () => [],
  getAgentProfile: () => undefined,
}));

describe("AgentActivityFeed", () => {
  it("shows loading skeleton when standalone and loading", () => {
    const { container } = render(ce(AgentActivityFeed, { standalone: true }));
    expect(container.querySelector(".loading-skeleton")).toBeTruthy();
  });

  it("renders nothing when loading and not standalone", () => {
    const { container } = render(ce(AgentActivityFeed, { standalone: false }));
    expect(container.firstChild).toBeNull();
  });

  it("accepts standalone prop (default false)", () => {
    // Should not throw when rendering with standalone=false (default)
    const { container } = render(ce(AgentActivityFeed));
    expect(container.firstChild).toBeNull();
  });

  it("renders standalone mode wrapper div", () => {
    // Even when loading, the standalone wrapper should have a class
    const { container } = render(ce(AgentActivityFeed, { standalone: true }));
    expect(container.querySelector(".activity-feed")).toBeTruthy();
  });
});
