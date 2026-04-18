// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Chip } from "./Chip";

describe("Chip", () => {
  it.each([
    "status",
    "meta",
    "tag",
    "danger",
    "warning",
    "success",
    "ai",
  ] as const)("emits data-family=%s", (family) => {
    const { getByText } = render(<Chip family={family}>{family}</Chip>);
    const chip = getByText(family);
    expect(chip).toHaveClass("chip");
    expect(chip).toHaveAttribute("data-family", family);
  });

  it("merges caller-provided className", () => {
    const { getByText } = render(
      <Chip family="meta" className="chip--dense">
        x
      </Chip>,
    );
    expect(getByText("x")).toHaveClass("chip", "chip--dense");
  });
});
