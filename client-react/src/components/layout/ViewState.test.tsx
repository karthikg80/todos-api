// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewState } from "./ViewState";

describe("ViewState", () => {
  it("renders children when not loading, error, or empty", () => {
    render(ce(ViewState, {}, ce("div", { "data-testid": "ready" }, "ready")));
    expect(screen.getByTestId("ready")).toBeTruthy();
  });

  it("renders the loading slot when loading is true", () => {
    render(
      ce(
        ViewState,
        {
          loading: true,
          loadingContent: ce("div", { "data-testid": "skeleton" }, "loading"),
        },
        ce("div", { "data-testid": "ready" }, "ready"),
      ),
    );
    expect(screen.getByTestId("skeleton")).toBeTruthy();
    expect(screen.queryByTestId("ready")).toBeNull();
  });

  it("renders a default loading message when no loadingContent provided", () => {
    render(
      ce(
        ViewState,
        { loading: true },
        ce("div", { "data-testid": "ready" }, "ready"),
      ),
    );
    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("renders error content with retry button and calls onRetry", () => {
    const onRetry = vi.fn();
    render(
      ce(
        ViewState,
        { error: "Boom", onRetry },
        ce("div", { "data-testid": "ready" }, "ready"),
      ),
    );
    expect(screen.getByText("Boom")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.queryByTestId("ready")).toBeNull();
  });

  it("renders error content without retry button when onRetry is missing", () => {
    render(
      ce(
        ViewState,
        { error: "Down" },
        ce("div", { "data-testid": "ready" }, "ready"),
      ),
    );
    expect(screen.getByText("Down")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Retry/i })).toBeNull();
  });

  it("renders empty content when empty is true and not loading/error", () => {
    render(
      ce(
        ViewState,
        {
          empty: true,
          emptyContent: ce("div", { "data-testid": "no-data" }, "Nothing here"),
        },
        ce("div", { "data-testid": "ready" }, "ready"),
      ),
    );
    expect(screen.getByTestId("no-data")).toBeTruthy();
    expect(screen.queryByTestId("ready")).toBeNull();
  });

  it("prefers loading over error and empty when both flags set", () => {
    render(
      ce(
        ViewState,
        {
          loading: true,
          error: "ignored",
          empty: true,
          loadingContent: ce("div", { "data-testid": "skeleton" }, "loading"),
        },
        ce("div", { "data-testid": "ready" }, "ready"),
      ),
    );
    expect(screen.getByTestId("skeleton")).toBeTruthy();
    expect(screen.queryByText("ignored")).toBeNull();
  });

  it("prefers error over empty when both flags set", () => {
    render(
      ce(
        ViewState,
        {
          error: "Bad",
          empty: true,
          emptyContent: ce("div", { "data-testid": "no-data" }, "empty"),
        },
        ce("div", { "data-testid": "ready" }, "ready"),
      ),
    );
    expect(screen.getByText("Bad")).toBeTruthy();
    expect(screen.queryByTestId("no-data")).toBeNull();
  });
});
