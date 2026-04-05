import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FocusPanel } from "./FocusPanel";

describe("FocusPanel", () => {
  it("renders with title and children", () => {
    render(
      <FocusPanel title="Right Now" color="danger">
        <p>Content here</p>
      </FocusPanel>,
    );
    expect(screen.getByText("Right Now")).toBeInTheDocument();
    expect(screen.getByText("Content here")).toBeInTheDocument();
  });

  it("shows pinned badge when pinned", () => {
    render(
      <FocusPanel title="Today" color="accent" pinned>
        <p>Tasks</p>
      </FocusPanel>,
    );
    expect(screen.getByText(/pinned/i)).toBeInTheDocument();
  });

  it("does not show pinned badge when not pinned", () => {
    render(
      <FocusPanel title="Due Soon" color="warning">
        <p>Tasks</p>
      </FocusPanel>,
    );
    expect(screen.queryByText(/pinned/i)).not.toBeInTheDocument();
  });

  it("shows subtitle when provided", () => {
    render(
      <FocusPanel title="Unsorted" color="warning" subtitle="3 items">
        <p>Items</p>
      </FocusPanel>,
    );
    expect(screen.getByText("3 items")).toBeInTheDocument();
  });
});
