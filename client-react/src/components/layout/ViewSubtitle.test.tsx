import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ViewSubtitle } from "./ViewSubtitle";

describe("ViewSubtitle", () => {
  it("renders default state", () => {
    render(
      <ViewSubtitle
        viewMode="list"
        sortBy="order"
        sortOrder="asc"
        groupBy="none"
        density="normal"
      />,
    );
    expect(
      screen.getByText("List · Default sort · No grouping"),
    ).toBeInTheDocument();
  });

  it("shows sort field and direction when not default", () => {
    render(
      <ViewSubtitle
        viewMode="list"
        sortBy="dueDate"
        sortOrder="desc"
        groupBy="none"
        density="normal"
      />,
    );
    expect(
      screen.getByText("List · Due date ↓ · No grouping"),
    ).toBeInTheDocument();
  });

  it("shows grouping when set", () => {
    render(
      <ViewSubtitle
        viewMode="board"
        sortBy="order"
        sortOrder="asc"
        groupBy="priority"
        density="normal"
      />,
    );
    expect(
      screen.getByText("Board · Default sort · Priority"),
    ).toBeInTheDocument();
  });

  it("shows density when not normal", () => {
    render(
      <ViewSubtitle
        viewMode="list"
        sortBy="order"
        sortOrder="asc"
        groupBy="none"
        density="compact"
      />,
    );
    expect(
      screen.getByText("List · Default sort · No grouping · Compact"),
    ).toBeInTheDocument();
  });

  it("shows full state", () => {
    render(
      <ViewSubtitle
        viewMode="list"
        sortBy="priority"
        sortOrder="asc"
        groupBy="project"
        density="spacious"
      />,
    );
    expect(
      screen.getByText("List · Priority ↑ · Project · Spacious"),
    ).toBeInTheDocument();
  });
});
