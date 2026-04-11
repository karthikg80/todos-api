// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComponentGalleryPage } from "./ComponentGalleryPage";

// Mock complex sub-components
vi.mock("../home/FlipCard", () => ({
  FlipCard: () => createElement("div", { "data-testid": "mock-flip-card" }),
  CardBack: () => createElement("div", { "data-testid": "mock-card-back" }),
}));

vi.mock("../shared/TarotCard", () => ({
  TarotCard: () => createElement("div", { "data-testid": "mock-tarot-card" }),
}));

vi.mock("../shared/pixel-art", () => ({
  default: () => createElement("div", { "data-testid": "mock-pixel-art" }),
}));

vi.mock("../todos/TodoRow", () => ({
  TodoRow: ({ todo, isActive }: { todo: { id: string; title: string }; isActive: boolean }) =>
    createElement("div", {
      "data-testid": `todo-row-${todo.id}`,
      "data-active": isActive,
    }, todo.title),
}));

const PLACEHOLDER = "Buttons, rows, profile\u2026";

vi.mock("../shared/SearchBar", () => ({
  SearchBar: ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
    createElement("input", {
      "data-testid": "mock-search-bar",
      value,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    }),
}));

vi.mock("../shared/ProfileLauncher", () => ({
  ProfileLauncher: () => createElement("div", { "data-testid": "mock-profile-launcher" }),
}));

vi.mock("../shared/UndoToast", () => ({
  UndoToast: ({ action }: { action: { message: string } | null }) =>
    createElement("div", { "data-testid": "mock-undo-toast" },
      action ? action.message : "no toast"
    ),
}));

vi.mock("../../utils/buildChips", () => ({
  buildChips: () => [
    { key: "priority-high", label: "High", variant: "priority" },
    { key: "status-ip", label: "In Progress", variant: "status" },
    { key: "tag-1", label: "design-system", variant: "tag" },
  ],
}));

const defaultProps = {
  dark: false,
  onBack: vi.fn(),
};

describe("ComponentGalleryPage", () => {
  it("renders with data-testid='component-gallery-page'", () => {
    render(createElement(ComponentGalleryPage, defaultProps));
    expect(screen.getByTestId("component-gallery-page")).toBeTruthy();
  });

  it("shows hero title 'Component gallery'", () => {
    render(createElement(ComponentGalleryPage, defaultProps));
    expect(screen.getByText("Component gallery")).toBeTruthy();
  });

  it("renders navigation preview items (Focus, Today, Upcoming, Tune-up)", () => {
    render(createElement(ComponentGalleryPage, defaultProps));
    expect(screen.getByText("Focus")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Upcoming")).toBeTruthy();
    expect(screen.getByText("Tune-up")).toBeTruthy();
  });

  it("shows filter input", () => {
    render(createElement(ComponentGalleryPage, defaultProps));
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    expect(input).toBeTruthy();
    expect(input.tagName).toBe("INPUT");
  });

  it("filters sections when filter text is typed", () => {
    render(createElement(ComponentGalleryPage, defaultProps));
    // All 6 sections visible initially (check by counting section cards)
    const initialSections = screen.getAllByText(/Actions and affordances|Workspace rail items|Search and view switching|Task chips and metadata|Live list row specimens|Account launcher and color tokens/);
    expect(initialSections.length).toBeGreaterThan(0);

    const filterInput = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(filterInput, { target: { value: "buttons" } });

    // Only the buttons section should remain
    expect(screen.getByText("Actions and affordances")).toBeTruthy();
    // Other section titles should not appear
    expect(screen.queryByText("Workspace rail items")).toBeNull();
  });

  it("shows empty state when filter matches nothing", () => {
    render(createElement(ComponentGalleryPage, defaultProps));
    const filterInput = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(filterInput, { target: { value: "xyznonexistent" } });

    expect(screen.getByText("No sections match that filter.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear filter" })).toBeTruthy();
  });

  it("clear filter button resets filter", () => {
    render(createElement(ComponentGalleryPage, defaultProps));
    const filterInput = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(filterInput, { target: { value: "xyznonexistent" } });

    // Empty state visible
    expect(screen.getByText("No sections match that filter.")).toBeTruthy();

    // Click clear
    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));

    // Sections should reappear
    expect(screen.getByText("Actions and affordances")).toBeTruthy();
    expect(screen.queryByText("No sections match that filter.")).toBeNull();
  });

  it("renders task row specimens (TodoRow components)", () => {
    render(createElement(ComponentGalleryPage, defaultProps));
    expect(screen.getByTestId("todo-row-preview-rich-row")).toBeTruthy();
    expect(screen.getByTestId("todo-row-preview-done-row")).toBeTruthy();
  });

  it("ProfileLauncher renders with sample user", () => {
    render(createElement(ComponentGalleryPage, defaultProps));
    expect(screen.getByTestId("mock-profile-launcher")).toBeTruthy();
  });

  it("view toggle buttons render (list/board mode)", () => {
    render(createElement(ComponentGalleryPage, defaultProps));
    const listButton = screen.getByRole("button", { name: "List preview" });
    const boardButton = screen.getByRole("button", { name: "Board preview" });
    expect(listButton).toBeTruthy();
    expect(boardButton).toBeTruthy();
  });

  it("UndoToast renders", () => {
    render(createElement(ComponentGalleryPage, defaultProps));
    expect(screen.getByTestId("mock-undo-toast")).toBeTruthy();
  });

  it("section count displays correctly (6)", () => {
    render(createElement(ComponentGalleryPage, defaultProps));
    // The hero stats show "6" for Live modules
    const stats = screen.getAllByText("6");
    expect(stats.length).toBeGreaterThan(0);
  });
});
