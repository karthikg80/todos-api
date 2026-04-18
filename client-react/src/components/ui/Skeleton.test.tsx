// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("defaults to the line shape", () => {
    const { container } = render(<Skeleton data-testid="s" />);
    const el = container.querySelector(".skel")!;
    expect(el).toHaveClass("skel", "skel--line");
  });

  it.each(["line", "title", "chip", "circle"] as const)(
    "applies the %s shape modifier",
    (shape) => {
      const { container } = render(<Skeleton shape={shape} />);
      const el = container.querySelector(".skel")!;
      expect(el).toHaveClass(`skel--${shape}`);
    },
  );

  it("accepts width + height overrides", () => {
    const { container } = render(<Skeleton width={120} height={24} />);
    const el = container.querySelector(".skel")! as HTMLElement;
    expect(el.style.width).toBe("120px");
    expect(el.style.height).toBe("24px");
  });

  it("is aria-hidden so assistive tech skips placeholder chrome", () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector(".skel")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
