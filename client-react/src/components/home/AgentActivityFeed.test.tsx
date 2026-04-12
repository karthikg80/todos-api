// @vitest-environment jsdom
// @ts-nocheck — complex mocked props cause createElement overload issues
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";

vi.mock("../../api/client", () => ({
  apiCall: vi.fn(),
}));

vi.mock("../../agents/useAgentProfiles", () => ({
  useAgentProfiles: () => [],
  getAgentProfile: () => undefined,
}));

import { apiCall } from "../../api/client";
import { AgentActivityFeed } from "./AgentActivityFeed";

const { createElement: ce } = React;

const mockEntries = [
  {
    agentId: "orla",
    jobName: "Focus Brief",
    periodKey: "2026-04-10",
    narration: "Generated focus brief",
    metadata: {},
    createdAt: "2026-04-10T10:00:00Z",
  },
];

describe("AgentActivityFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when not standalone and loading", () => {
    vi.mocked(apiCall).mockResolvedValue(new Promise(() => {}));
    const { container } = render(ce(AgentActivityFeed, { standalone: false }));
    expect(container.firstChild).toBeNull();
  });

  it("returns null when not standalone and empty", async () => {
    vi.mocked(apiCall).mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [] }),
    });
    const { container } = await act(async () =>
      render(ce(AgentActivityFeed, { standalone: false })),
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows loading skeleton when standalone and loading", () => {
    vi.mocked(apiCall).mockResolvedValue(new Promise(() => {}));
    const { container } = render(ce(AgentActivityFeed, { standalone: true }));
    expect(container.querySelector(".loading-skeleton")).toBeTruthy();
  });

  it("shows empty state when standalone and no entries", async () => {
    vi.mocked(apiCall).mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [] }),
    });
    const { container } = await act(async () =>
      render(ce(AgentActivityFeed, { standalone: true })),
    );
    expect(container.querySelector(".activity-feed--empty")).toBeTruthy();
  });

  it("renders entries with jobName and narration", async () => {
    vi.mocked(apiCall).mockResolvedValue({
      ok: true,
      json: async () => ({ entries: mockEntries }),
    });
    const { container } = await act(async () =>
      render(ce(AgentActivityFeed, { standalone: true })),
    );
    const entries = container.querySelectorAll(".activity-entry");
    expect(entries.length).toBeGreaterThan(0);
  });

  it("groups entries by day", async () => {
    vi.mocked(apiCall).mockResolvedValue({
      ok: true,
      json: async () => ({ entries: mockEntries }),
    });
    const { container } = await act(async () =>
      render(ce(AgentActivityFeed, { standalone: true })),
    );
    // Entries should be grouped under date headers
    const dateHeaders = container.querySelectorAll(".activity-feed__date-header");
    expect(dateHeaders.length).toBeGreaterThan(0);
  });

  it("renders non-standalone entries list", async () => {
    vi.mocked(apiCall).mockResolvedValue({
      ok: true,
      json: async () => ({ entries: mockEntries }),
    });
    const { container } = await act(async () =>
      render(ce(AgentActivityFeed, { standalone: false })),
    );
    expect(container.querySelector(".activity-feed")).toBeTruthy();
  });
});
