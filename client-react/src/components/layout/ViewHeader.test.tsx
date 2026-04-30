// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewHeader } from "./ViewHeader";

describe("ViewHeader", () => {
  it("renders the title as a heading", () => {
    render(ce(ViewHeader, { title: "Tune-up" }));
    expect(screen.getByRole("heading", { name: "Tune-up" })).toBeTruthy();
  });

  it("renders a count next to the title when provided", () => {
    render(ce(ViewHeader, { title: "Today", count: 7 }));
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("renders a subtitle below the title when provided", () => {
    render(
      ce(ViewHeader, {
        title: "Weekly Review",
        subtitle: "Week of Apr 26",
      }),
    );
    expect(screen.getByText("Week of Apr 26")).toBeTruthy();
  });

  it("renders breadcrumb segments when crumb has more than one segment", () => {
    render(ce(ViewHeader, { crumb: "Settings › Tune-up", title: "Tune-up" }));
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("does not render breadcrumb when crumb is a single segment", () => {
    render(ce(ViewHeader, { crumb: "Settings", title: "Settings" }));
    expect(screen.queryByRole("navigation", { name: "Location" })).toBeNull();
  });

  it("renders actions on the right when provided", () => {
    render(
      ce(ViewHeader, {
        title: "Tune-up",
        actions: ce("button", { type: "button" }, "Refresh"),
      }),
    );
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
  });

  it("renders controls below the title when provided", () => {
    render(
      ce(ViewHeader, {
        title: "Settings",
        controls: ce("div", { "data-testid": "tabs" }, "tabs"),
      }),
    );
    expect(screen.getByTestId("tabs")).toBeTruthy();
  });

  it("renders a back button and calls onClick when back is provided", () => {
    const onBack = vi.fn();
    render(ce(ViewHeader, { title: "Settings", back: { onClick: onBack } }));
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("uses a custom back label when provided", () => {
    const onBack = vi.fn();
    render(
      ce(ViewHeader, {
        title: "Feedback",
        back: { onClick: onBack, label: "Workspace" },
      }),
    );
    expect(screen.getByRole("button", { name: /Workspace/i })).toBeTruthy();
  });

  it("does not render a count slot when count is undefined", () => {
    const { container } = render(ce(ViewHeader, { title: "Plain" }));
    expect(container.querySelector(".view-header__count")).toBeNull();
  });

  it("renders count of zero when explicitly provided", () => {
    render(ce(ViewHeader, { title: "Inbox", count: 0 }));
    expect(screen.getByText("0")).toBeTruthy();
  });
});
