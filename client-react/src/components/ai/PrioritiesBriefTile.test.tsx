// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrioritiesBriefTile } from "./PrioritiesBriefTile";
import * as aiApi from "../../api/ai";

vi.mock("../../api/ai", () => ({
  fetchPrioritiesBrief: vi.fn(),
  refreshPrioritiesBrief: vi.fn(),
}));

describe("PrioritiesBriefTile", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders cached priorities immediately and swaps in refreshed content", async () => {
    vi.useFakeTimers();
    vi.mocked(aiApi.fetchPrioritiesBrief)
      .mockResolvedValueOnce({
        html: "<p>Cached priorities</p>",
        generatedAt: "2026-03-20T11:00:00.000Z",
        expiresAt: "2026-03-20T15:00:00.000Z",
        cached: true,
        isStale: true,
        refreshInFlight: true,
      })
      .mockResolvedValueOnce({
        html: "<p>Fresh priorities</p>",
        generatedAt: "2026-03-20T11:05:00.000Z",
        expiresAt: "2026-03-20T15:05:00.000Z",
        cached: false,
        isStale: false,
        refreshInFlight: false,
      });

    window.localStorage.setItem(
      "todos:home-priorities-brief-cache",
      JSON.stringify({
        html: "<p>Cached priorities</p>",
        generatedAt: "2026-03-20T11:00:00.000Z",
        expiresAt: "2026-03-20T15:00:00.000Z",
      }),
    );

    render(<PrioritiesBriefTile />);

    expect(screen.getByTestId("home-priorities-tile")).toHaveTextContent(
      "Cached priorities",
    );

    await waitFor(() =>
      expect(screen.getByTestId("home-priorities-tile")).toHaveTextContent(
        "Updating priorities in the background",
      ),
    );

    await vi.advanceTimersByTimeAsync(1500);

    await waitFor(() =>
      expect(screen.getByTestId("home-priorities-tile")).toHaveTextContent(
        "Fresh priorities",
      ),
    );
  });

  it("keeps the last visible priorities when refresh fails", async () => {
    vi.mocked(aiApi.fetchPrioritiesBrief)
      .mockResolvedValueOnce({
        html: "<p>Visible priorities</p>",
        generatedAt: "2026-03-20T12:00:00.000Z",
        cached: false,
        isStale: false,
        refreshInFlight: false,
      })
      .mockResolvedValueOnce(null);
    vi.mocked(aiApi.refreshPrioritiesBrief).mockResolvedValue(null);

    render(<PrioritiesBriefTile />);

    await waitFor(() =>
      expect(screen.getByTestId("home-priorities-tile")).toHaveTextContent(
        "Visible priorities",
      ),
    );

    screen.getByRole("button", { name: "Refresh" }).click();

    await waitFor(() =>
      expect(screen.getByTestId("home-priorities-tile")).toHaveTextContent(
        "Showing the last update.",
      ),
    );
    expect(screen.getByTestId("home-priorities-tile")).toHaveTextContent(
      "Visible priorities",
    );
  });
});
