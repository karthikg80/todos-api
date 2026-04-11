// @vitest-environment jsdom
// @ts-nocheck — complex mocked props cause createElement overload issues
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// Mock ALL complex sub-components before importing SettingsPage
vi.mock("../../api/client", () => ({
  apiCall: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  }),
}));

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Test User", email: "test@example.com", isVerified: true },
    setUser: vi.fn(),
  }),
}));

vi.mock("../../features/settings/AgentsPanel", () => ({
  AgentsPanel: () => ce("div", { "data-testid": "agents-panel" }),
}));

vi.mock("../shared/ToggleSwitch", () => ({
  ToggleSwitch: ({ checked, label, onChange }) =>
    ce("button", {
      "data-testid": "toggle-" + label.replace(/\s+/g, "-").toLowerCase(),
      "data-checked": String(checked),
      onClick: onChange,
    }, label),
}));

vi.mock("../shared/SearchBar", () => ({
  SearchBar: () => ce("div", { "data-testid": "searchbar" }),
}));

vi.mock("../shared/SegmentedControl", () => ({
  SegmentedControl: ({ options }) =>
    ce("div", { "data-testid": "segmented" },
      options.map((o: any) => ce("button", { key: o.value }, o.label)),
    ),
}));

vi.mock("./settingsModels", () => ({
  CHUNK_MINUTE_OPTIONS: [{ value: 15, label: "15 min" }],
  DEFAULT_USER_PREFERENCES: { maxDailyTasks: 5, preferredChunkMinutes: null, waitingFollowUpDays: 3, weekendsActive: false, preferredContexts: [], soulProfile: null },
  SOUL_DAILY_RITUAL_OPTIONS: [{ value: "neither", label: "Neither" }],
  SOUL_ENERGY_PATTERN_OPTIONS: [{ value: "variable", label: "Variable" }],
  SOUL_PLANNING_STYLE_OPTIONS: [{ value: "both", label: "Both" }],
  SOUL_TONE_OPTIONS: [{ value: "calm", label: "Calm" }],
  mergePlanningPreferences: (data: any) => ({ ...data, preferredContexts: data.preferredContexts || [], soulProfile: data.soulProfile || null }),
  parsePreferredContexts: (input: string) => input.split(",").map((s: string) => s.trim()).filter(Boolean),
}));

vi.mock("./AdminFeedbackWorkflow", () => ({
  AdminFeedbackWorkflow: () => ce("div", { "data-testid": "feedback-workflow" }),
}));

import { SettingsPage } from "./SettingsPage";

const { createElement: ce } = React;

const defaultProps = {
  dark: false,
  onToggleDark: vi.fn(),
  uiMode: "normal",
  onToggleUiMode: vi.fn(),
  density: "balanced",
  onCycleDensity: vi.fn(),
  onBack: vi.fn(),
  onOpenTuneUp: vi.fn(),
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders settings page with title", () => {
    render(ce(SettingsPage, defaultProps));
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("renders back button and calls onBack", () => {
    render(ce(SettingsPage, defaultProps));
    const backBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("Back"));
    if (backBtn) fireEvent.click(backBtn);
    expect(defaultProps.onBack).toHaveBeenCalled();
  });

  it("renders profile section", () => {
    render(ce(SettingsPage, defaultProps));
    expect(screen.getByText("Profile")).toBeTruthy();
  });

  it("pre-fills name and email from user", () => {
    render(ce(SettingsPage, defaultProps));
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Test User");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("test@example.com");
  });

  it("renders appearance section", () => {
    render(ce(SettingsPage, defaultProps));
    expect(screen.getByText("Appearance")).toBeTruthy();
  });

  it("toggles dark mode", () => {
    render(ce(SettingsPage, defaultProps));
    fireEvent.click(screen.getByTestId("toggle-dark-mode"));
    expect(defaultProps.onToggleDark).toHaveBeenCalled();
  });

  it("renders account section", () => {
    render(ce(SettingsPage, defaultProps));
    expect(screen.getByText("Account")).toBeTruthy();
  });

  it("renders tune-up button and calls onOpenTuneUp", () => {
    render(ce(SettingsPage, defaultProps));
    fireEvent.click(screen.getByText("Open Tune-up"));
    expect(defaultProps.onOpenTuneUp).toHaveBeenCalled();
  });

  it("renders agents panel", () => {
    render(ce(SettingsPage, defaultProps));
    expect(screen.getByTestId("agents-panel")).toBeTruthy();
  });

  it("renders data export button", () => {
    render(ce(SettingsPage, defaultProps));
    expect(screen.getByText("Download JSON")).toBeTruthy();
  });

  it("renders archived projects section", () => {
    render(ce(SettingsPage, defaultProps));
    expect(screen.getByText("Archived Projects")).toBeTruthy();
  });

  it("enables save when name is changed", () => {
    render(ce(SettingsPage, defaultProps));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Name" } });
    expect(screen.getByRole("button", { name: "Save profile" })).not.toBeDisabled();
  });
});
