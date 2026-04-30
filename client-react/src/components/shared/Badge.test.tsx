// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders children inside a badge with the muted tone by default", () => {
    const { container } = render(ce(Badge, {}, "Submitted"));
    const badge = container.querySelector(".badge");
    expect(badge).toBeTruthy();
    expect(badge?.classList.contains("badge--muted")).toBe(true);
    expect(screen.getByText("Submitted")).toBeTruthy();
  });

  it("applies the requested tone modifier", () => {
    const tones = ["info", "warning", "success", "muted", "danger"] as const;
    for (const tone of tones) {
      const { container } = render(ce(Badge, { tone }, tone));
      expect(container.querySelector(`.badge.badge--${tone}`)).toBeTruthy();
    }
  });

  it("applies the size modifier when set to sm", () => {
    const { container } = render(ce(Badge, { size: "sm" }, "x"));
    expect(container.querySelector(".badge.badge--sm")).toBeTruthy();
  });

  it("uses the medium size by default and omits the modifier", () => {
    const { container } = render(ce(Badge, {}, "x"));
    const badge = container.querySelector(".badge");
    expect(badge?.classList.contains("badge--sm")).toBe(false);
    expect(badge?.classList.contains("badge--lg")).toBe(false);
  });
});
