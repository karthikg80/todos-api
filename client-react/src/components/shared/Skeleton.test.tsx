// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("renders a row variant by default", () => {
    const { container } = render(ce(Skeleton, {}));
    const root = container.querySelector(".skeleton");
    expect(root).toBeTruthy();
    expect(root?.classList.contains("skeleton--row")).toBe(true);
  });

  it("supports the card, board-column, and panel variants", () => {
    const variants = ["card", "board-column", "panel"] as const;
    for (const variant of variants) {
      const { container } = render(ce(Skeleton, { variant }));
      expect(
        container.querySelector(`.skeleton.skeleton--${variant}`),
      ).toBeTruthy();
    }
  });

  it("renders the requested number of rows for the row variant", () => {
    const { container } = render(ce(Skeleton, { variant: "row", count: 3 }));
    expect(container.querySelectorAll(".skeleton__row").length).toBe(3);
  });

  it("renders three card placeholders for the board-column variant", () => {
    const { container } = render(ce(Skeleton, { variant: "board-column" }));
    expect(container.querySelectorAll(".skeleton__card").length).toBe(3);
  });

  it("is announced as busy to assistive tech", () => {
    render(ce(Skeleton, { variant: "row", "aria-label": "Loading items" }));
    const region = screen.getByRole("status", { name: /Loading items/i });
    expect(region.getAttribute("aria-busy")).toBe("true");
  });
});
