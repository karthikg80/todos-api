import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ViewMenu } from "./ViewMenu";

const defaultProps = {
  viewMode: "list" as const,
  onViewModeChange: vi.fn(),
  sortBy: "order" as const,
  sortOrder: "asc" as const,
  onSortChange: vi.fn(),
  groupBy: "none" as const,
  onGroupByChange: vi.fn(),
  density: "normal" as const,
  onDensityChange: vi.fn(),
};

describe("ViewMenu", () => {
  it("renders trigger button", () => {
    render(<ViewMenu {...defaultProps} />);
    expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument();
  });

  it("opens popover on click", () => {
    render(<ViewMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /view/i }));
    expect(screen.getByText("Layout")).toBeInTheDocument();
    expect(screen.getByText("Group by")).toBeInTheDocument();
    expect(screen.getByText("Sort by")).toBeInTheDocument();
    expect(screen.getByText("Density")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<ViewMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /view/i }));
    expect(screen.getByText("Layout")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Layout")).not.toBeInTheDocument();
  });

  it("calls onViewModeChange when layout option clicked", () => {
    const onViewModeChange = vi.fn();
    render(<ViewMenu {...defaultProps} onViewModeChange={onViewModeChange} />);
    fireEvent.click(screen.getByRole("button", { name: /view/i }));
    fireEvent.click(screen.getByRole("button", { name: "Board" }));
    expect(onViewModeChange).toHaveBeenCalledWith("board");
  });

  it("calls onGroupByChange when group option clicked", () => {
    const onGroupByChange = vi.fn();
    render(<ViewMenu {...defaultProps} onGroupByChange={onGroupByChange} />);
    fireEvent.click(screen.getByRole("button", { name: /view/i }));
    fireEvent.click(screen.getByRole("button", { name: "Priority" }));
    expect(onGroupByChange).toHaveBeenCalledWith("priority");
  });

  it("calls onSortChange when sort option clicked", () => {
    const onSortChange = vi.fn();
    render(<ViewMenu {...defaultProps} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByRole("button", { name: /view/i }));
    fireEvent.click(screen.getByRole("button", { name: "Due date" }));
    expect(onSortChange).toHaveBeenCalledWith("dueDate", "asc");
  });

  it("toggles sort direction", () => {
    const onSortChange = vi.fn();
    render(<ViewMenu {...defaultProps} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByRole("button", { name: /view/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /ascending|descending/i }),
    );
    expect(onSortChange).toHaveBeenCalledWith("order", "desc");
  });

  it("calls onDensityChange when density option clicked", () => {
    const onDensityChange = vi.fn();
    render(<ViewMenu {...defaultProps} onDensityChange={onDensityChange} />);
    fireEvent.click(screen.getByRole("button", { name: /view/i }));
    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    expect(onDensityChange).toHaveBeenCalledWith("compact");
  });

  it("highlights active options", () => {
    render(
      <ViewMenu
        {...defaultProps}
        groupBy="priority"
        sortBy="dueDate"
        density="spacious"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /view/i }));
    expect(screen.getByRole("button", { name: "Priority" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Due date" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Spacious" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("disables sort and group sections in board mode", () => {
    render(<ViewMenu {...defaultProps} viewMode="board" />);
    fireEvent.click(screen.getByRole("button", { name: /view/i }));
    // Group by and Sort by buttons should be disabled
    expect(screen.getByRole("button", { name: "Project" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Created" })).toBeDisabled();
  });

  it("respects groupByOptions filter", () => {
    render(
      <ViewMenu
        {...defaultProps}
        groupByOptions={["none", "status", "priority", "dueDate"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /view/i }));
    expect(
      screen.queryByRole("button", { name: "Project" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
  });
});
