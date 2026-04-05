import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CardCarousel } from "./CardCarousel";

describe("CardCarousel", () => {
  const cards = [
    <div key="a">Card A</div>,
    <div key="b">Card B</div>,
    <div key="c">Card C</div>,
  ];

  it("renders all slides", () => {
    render(<CardCarousel>{cards}</CardCarousel>);
    expect(screen.getByText("Card A")).toBeInTheDocument();
    expect(screen.getByText("Card B")).toBeInTheDocument();
    expect(screen.getByText("Card C")).toBeInTheDocument();
  });

  it("renders dot indicator with correct count", () => {
    const { container } = render(<CardCarousel>{cards}</CardCarousel>);
    expect(container.querySelectorAll(".m-dot").length).toBe(3);
  });

  it("first dot is active by default", () => {
    const { container } = render(<CardCarousel>{cards}</CardCarousel>);
    const dots = container.querySelectorAll(".m-dot");
    expect(dots[0].classList.contains("m-dot--active")).toBe(true);
  });

  it("hides dots for single card", () => {
    const { container } = render(
      <CardCarousel>{[<div key="only">Only card</div>]}</CardCarousel>,
    );
    expect(container.querySelector(".m-dot-indicator")).toBeNull();
  });
});
