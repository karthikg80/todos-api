// @vitest-environment jsdom
import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const mocks = vi.hoisted(() => ({
  navigateWithFade: vi.fn(),
}));

vi.mock("./utils/pageTransitions", () => ({
  navigateWithFade: mocks.navigateWithFade,
}));

vi.mock("./components/layout/AppShell", () => ({
  AppShell: () => createElement("div", null, "App shell"),
}));

describe("App auth gate", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to auth when user hydration fails with only a token present", async () => {
    localStorage.setItem("authToken", "stale-token");

    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(null, { status: 401 }),
    );

    render(createElement(App));

    await waitFor(() => {
      expect(mocks.navigateWithFade).toHaveBeenCalledWith("/auth?next=/app", {
        replace: true,
      });
    });
    expect(screen.queryByText("App shell")).toBeNull();
  });
});
