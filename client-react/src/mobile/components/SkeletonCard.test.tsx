import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SkeletonCard } from "./SkeletonCard";

describe("SkeletonCard", () => {
  it("renders card name and subtitle", () => {
    render(
      <SkeletonCard name="The Flame" subtitle="Your priorities right now" numeral="I" source="ai" />,
    );
    expect(screen.getByText("The Flame")).toBeInTheDocument();
    expect(screen.getByText("Your priorities right now")).toBeInTheDocument();
  });

  it("renders shimmer bars in content area", () => {
    const { container } = render(
      <SkeletonCard name="The Dawn" subtitle="Today's agenda" numeral="II" source="sys" />,
    );
    expect(container.querySelectorAll(".m-shimmer-bar").length).toBeGreaterThanOrEqual(2);
  });

  it("does not render a dog-ear", () => {
    const { container } = render(
      <SkeletonCard name="The Flame" subtitle="Your priorities right now" numeral="I" source="ai" />,
    );
    expect(container.querySelector(".dog-ear")).toBeNull();
  });
});
