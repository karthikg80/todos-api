import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProjectKebabMenu } from "./ProjectKebabMenu";

const defaultProps = {
  onToggleSettings: vi.fn(),
  settingsOpen: false,
  onRename: vi.fn(),
  onDuplicate: vi.fn(),
  onRepeat: vi.fn(),
  onComplete: vi.fn(),
  onArchive: vi.fn(),
  onDelete: vi.fn(),
};

describe("ProjectKebabMenu", () => {
  it("renders kebab trigger button", () => {
    render(<ProjectKebabMenu {...defaultProps} />);
    expect(screen.getByRole("button", { name: /project actions/i })).toBeInTheDocument();
  });

  it("opens menu on click", () => {
    render(<ProjectKebabMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    expect(screen.getByRole("menuitem", { name: /show settings/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /rename/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /duplicate project/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /repeat project/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /complete project/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /archive/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
  });

  it("can render a hide settings action", () => {
    render(<ProjectKebabMenu {...defaultProps} settingsOpen />);
    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    expect(screen.getByRole("menuitem", { name: /hide settings/i })).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<ProjectKebabMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menuitem", { name: /rename/i })).not.toBeInTheDocument();
  });

  it("calls onToggleSettings and closes", () => {
    const onToggleSettings = vi.fn();
    render(
      <ProjectKebabMenu {...defaultProps} onToggleSettings={onToggleSettings} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /show settings/i }));
    expect(onToggleSettings).toHaveBeenCalled();
    expect(
      screen.queryByRole("menuitem", { name: /show settings/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onRename and closes", () => {
    const onRename = vi.fn();
    render(<ProjectKebabMenu {...defaultProps} onRename={onRename} />);
    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /rename/i }));
    expect(onRename).toHaveBeenCalled();
    expect(screen.queryByRole("menuitem", { name: /rename/i })).not.toBeInTheDocument();
  });

  it("calls onArchive and closes", () => {
    const onArchive = vi.fn();
    render(<ProjectKebabMenu {...defaultProps} onArchive={onArchive} />);
    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /archive/i }));
    expect(onArchive).toHaveBeenCalled();
  });

  it("calls onDuplicate and closes", () => {
    const onDuplicate = vi.fn();
    render(<ProjectKebabMenu {...defaultProps} onDuplicate={onDuplicate} />);
    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /duplicate project/i }));
    expect(onDuplicate).toHaveBeenCalled();
  });

  it("calls onRepeat and closes", () => {
    const onRepeat = vi.fn();
    render(<ProjectKebabMenu {...defaultProps} onRepeat={onRepeat} />);
    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /repeat project/i }));
    expect(onRepeat).toHaveBeenCalled();
  });

  it("calls onComplete and closes", () => {
    const onComplete = vi.fn();
    render(<ProjectKebabMenu {...defaultProps} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /complete project/i }));
    expect(onComplete).toHaveBeenCalled();
  });

  it("shows confirmation on delete click", () => {
    const onDelete = vi.fn();
    render(<ProjectKebabMenu {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/tasks will become unsorted/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeInTheDocument();
  });

  it("calls onDelete after confirmation", () => {
    const onDelete = vi.fn();
    render(<ProjectKebabMenu {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));
    expect(onDelete).toHaveBeenCalled();
  });
});
