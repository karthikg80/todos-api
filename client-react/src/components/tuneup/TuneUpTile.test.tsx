// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TuneUpData } from "../../types/tuneup";
import { TuneUpTile } from "./TuneUpTile";
import { useTuneUp } from "../../hooks/useTuneUp";

vi.mock("../../hooks/useTuneUp", () => ({
  useTuneUp: vi.fn(),
}));

const emptyData: TuneUpData = {
  duplicates: null,
  stale: null,
  quality: null,
  taxonomy: null,
};

const idleLoading = {
  duplicates: false,
  stale: false,
  quality: false,
  taxonomy: false,
};

function tuneUpStub(partial: Partial<ReturnType<typeof useTuneUp>>) {
  return {
    data: emptyData,
    loading: { ...idleLoading },
    error: {
      duplicates: null,
      stale: null,
      quality: null,
      taxonomy: null,
    },
    dismissed: new Set<string>(),
    patchedTaskIds: new Set<string>(),
    patchedProjectIds: new Set<string>(),
    hasFetched: false,
    allSettled: true,
    lastFetchedAt: null as number | null,
    load: vi.fn(),
    refresh: vi.fn(),
    refreshSection: vi.fn(),
    dismiss: vi.fn(),
    patchTaskOut: vi.fn(),
    unpatchTaskOut: vi.fn(),
    patchProjectOut: vi.fn(),
    unpatchProjectOut: vi.fn(),
    patchQualityResolved: vi.fn(),
    patchStaleResolved: vi.fn(),
    restoreStaleTask: vi.fn(),
    ...partial,
  } as ReturnType<typeof useTuneUp>;
}

describe("TuneUpTile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls load on mount", () => {
    const load = vi.fn();
    vi.mocked(useTuneUp).mockReturnValue(tuneUpStub({ load }));
    render(ce(TuneUpTile, {}));
    expect(load).toHaveBeenCalled();
  });

  it("shows all-failed empty state when settled without fetch", () => {
    vi.mocked(useTuneUp).mockReturnValue(
      tuneUpStub({
        hasFetched: false,
        allSettled: true,
        loading: { ...idleLoading },
      }),
    );
    render(ce(TuneUpTile, {}));
    expect(screen.getByText("Couldn't analyze")).toBeTruthy();
  });

  it("shows analyzing when loading with no top finding yet", () => {
    vi.mocked(useTuneUp).mockReturnValue(
      tuneUpStub({
        hasFetched: false,
        loading: { ...idleLoading, duplicates: true },
        data: emptyData,
      }),
    );
    render(ce(TuneUpTile, {}));
    expect(screen.getByLabelText("Analyzing...")).toBeTruthy();
  });

  it("shows early finding with danger cue when tier <= 3 while still loading", () => {
    vi.mocked(useTuneUp).mockReturnValue(
      tuneUpStub({
        hasFetched: false,
        loading: { ...idleLoading, duplicates: true },
        data: {
          ...emptyData,
          duplicates: {
            groups: [
              {
                confidence: 0.96,
                reason: "test",
                tasks: [
                  {
                    id: "a",
                    title: "A",
                    status: "open",
                    projectId: null,
                  },
                  {
                    id: "b",
                    title: "B",
                    status: "open",
                    projectId: null,
                  },
                ],
                suggestedAction: "merge",
              },
            ],
            totalTasks: 2,
          },
        },
      }),
    );
    render(ce(TuneUpTile, {}));
    expect(
      screen.getByText(/exact duplicate task group found/i),
    ).toBeTruthy();
    expect(screen.getByText("Needs attention")).toBeTruthy();
    expect(screen.getByText(/still analyzing/i)).toBeTruthy();
  });

  it("shows settled quality finding for mid-tier severity styling", () => {
    vi.mocked(useTuneUp).mockReturnValue(
      tuneUpStub({
        hasFetched: true,
        allSettled: true,
        data: {
          ...emptyData,
          quality: {
            results: [
              {
                id: "q1",
                title: "Split me",
                qualityScore: 0.4,
                issues: ["typo"],
                suggestions: ["fix"],
              },
            ],
            totalAnalyzed: 1,
          },
        },
      }),
    );
    render(ce(TuneUpTile, {}));
    expect(
      screen.getByText(/with title quality issues/i),
    ).toBeTruthy();
    expect(screen.queryByText("Needs attention")).toBeNull();
  });

  it("shows settled taxonomy finding with muted styling branch", () => {
    vi.mocked(useTuneUp).mockReturnValue(
      tuneUpStub({
        hasFetched: true,
        allSettled: true,
        data: {
          ...emptyData,
          taxonomy: {
            similarProjects: [
              {
                projectAName: "Alpha",
                projectBName: "Beta",
                projectAId: "p1",
                projectBId: "p2",
              },
            ],
            smallProjects: [],
          },
        },
      }),
    );
    render(ce(TuneUpTile, {}));
    expect(
      screen.getByText(/project organization suggestion/i),
    ).toBeTruthy();
  });

  it("shows settled exact-duplicate finding with freshness", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T12:00:00.000Z"));
    const lastFetchedAt = new Date("2024-01-01T11:55:00.000Z").getTime();
    vi.mocked(useTuneUp).mockReturnValue(
      tuneUpStub({
        hasFetched: true,
        allSettled: true,
        lastFetchedAt,
        data: {
          ...emptyData,
          duplicates: {
            groups: [
              {
                confidence: 0.96,
                reason: "test",
                tasks: [
                  {
                    id: "a",
                    title: "A",
                    status: "open",
                    projectId: null,
                  },
                  {
                    id: "b",
                    title: "B",
                    status: "open",
                    projectId: null,
                  },
                ],
                suggestedAction: "merge",
              },
            ],
            totalTasks: 2,
          },
        },
      }),
    );
    render(ce(TuneUpTile, {}));
    expect(screen.getByText("Needs attention")).toBeTruthy();
    expect(screen.getByText(/last checked 5m ago/i)).toBeTruthy();
  });

  it("shows all clear when settled with no findings", () => {
    vi.mocked(useTuneUp).mockReturnValue(
      tuneUpStub({
        hasFetched: true,
        allSettled: true,
        data: emptyData,
      }),
    );
    render(ce(TuneUpTile, {}));
    expect(
      screen.getByText(/all clear — nothing to clean up/i),
    ).toBeTruthy();
  });

  it("labels freshness as just now when last fetch was under a minute ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01T12:00:30.000Z"));
    const lastFetchedAt = new Date("2024-06-01T12:00:00.000Z").getTime();
    vi.mocked(useTuneUp).mockReturnValue(
      tuneUpStub({
        hasFetched: true,
        allSettled: true,
        lastFetchedAt,
        data: emptyData,
      }),
    );
    render(ce(TuneUpTile, {}));
    expect(screen.getByText(/last checked just now/i)).toBeTruthy();
  });

  it("uses hours label when last fetch was over an hour ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01T14:00:00.000Z"));
    const lastFetchedAt = new Date("2024-06-01T12:30:00.000Z").getTime();
    vi.mocked(useTuneUp).mockReturnValue(
      tuneUpStub({
        hasFetched: true,
        allSettled: true,
        lastFetchedAt,
        data: {
          ...emptyData,
          taxonomy: {
            similarProjects: [
              {
                projectAName: "X",
                projectBName: "Y",
                projectAId: "a",
                projectBId: "b",
              },
            ],
            smallProjects: [],
          },
        },
      }),
    );
    render(ce(TuneUpTile, {}));
    expect(screen.getByText(/last checked 1h ago/i)).toBeTruthy();
  });
});
