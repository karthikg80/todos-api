import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FlipCard } from "./FlipCard";

describe("FlipCard", () => {
  it("shows front by default", () => {
    render(
      <FlipCard
        front={<div>Front content</div>}
        back={<div>Back content</div>}
      />,
    );
    expect(screen.getByText("Front content")).toBeInTheDocument();
  });

  it("flips to back when dog-ear is clicked", () => {
    render(
      <FlipCard
        front={<div>Front content</div>}
        back={<div>Back content</div>}
      />,
    );
    const dogEar = screen.getAllByTitle(/flip/i)[0];
    fireEvent.click(dogEar);
    // After flip, back should be visible (the card has rotated)
    expect(screen.getByText("Back content")).toBeInTheDocument();
  });

  it("flips back to front when back dog-ear is clicked", () => {
    render(
      <FlipCard
        front={<div>Front content</div>}
        back={<div>Back content</div>}
      />,
    );
    // Flip to back
    const dogEars = screen.getAllByTitle(/flip/i);
    fireEvent.click(dogEars[0]);
    // Flip back to front
    const backDogEars = screen.getAllByTitle(/flip/i);
    fireEvent.click(backDogEars[1] || backDogEars[0]);
    // Should show front again
    expect(screen.getByText("Front content")).toBeInTheDocument();
  });

  it("uses controlled flipped prop when provided", () => {
    const { rerender } = render(
      <FlipCard
        front={<div>Front</div>}
        back={<div>Back</div>}
        flipped={false}
        onFlipChange={() => {}}
      />,
    );
    expect(document.querySelector(".flip-card--flipped")).not.toBeInTheDocument();

    rerender(
      <FlipCard
        front={<div>Front</div>}
        back={<div>Back</div>}
        flipped={true}
        onFlipChange={() => {}}
      />,
    );
    expect(document.querySelector(".flip-card--flipped")).toBeInTheDocument();
  });

  it("calls onFlipChange instead of toggling internal state in controlled mode", () => {
    const onFlipChange = vi.fn();
    render(
      <FlipCard
        front={<div>Front</div>}
        back={<div>Back</div>}
        flipped={false}
        onFlipChange={onFlipChange}
      />,
    );
    const dogEar = screen.getAllByTitle(/flip/i)[0];
    fireEvent.click(dogEar);
    expect(onFlipChange).toHaveBeenCalledWith(true);
    expect(document.querySelector(".flip-card--flipped")).not.toBeInTheDocument();
  });
});
