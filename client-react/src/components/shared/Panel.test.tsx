// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Panel } from "./Panel";

describe("Panel", () => {
  it("renders children inside a panel", () => {
    render(ce(Panel, {}, ce("p", { "data-testid": "body" }, "hello")));
    expect(screen.getByTestId("body")).toBeTruthy();
  });

  it("renders a title when provided", () => {
    render(ce(Panel, { title: "Right now" }, ce("p", null, "x")));
    expect(screen.getByText("Right now")).toBeTruthy();
  });

  it("renders an action slot in the header when provided", () => {
    render(
      ce(
        Panel,
        {
          title: "Today",
          action: ce("button", { type: "button" }, "View all"),
        },
        ce("p", null, "x"),
      ),
    );
    expect(screen.getByRole("button", { name: "View all" })).toBeTruthy();
  });

  it("omits the header when no title and no action are provided", () => {
    const { container } = render(ce(Panel, {}, ce("p", null, "x")));
    expect(container.querySelector(".panel__header")).toBeNull();
  });
});
