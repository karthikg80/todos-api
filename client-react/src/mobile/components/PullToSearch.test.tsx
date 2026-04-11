// @vitest-environment jsdom
// @ts-nocheck — component uses TouchEvent which jsdom doesn't fully support
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { PullToSearch } from "./PullToSearch";

const { createElement: ce } = React;

const mockTodos = [
  { id: "t1", title: "Write report", description: "Important", completed: false, tags: ["work"], projectId: "p1" },
];

const mockProjects = [
  { id: "p1", name: "Work", status: "active", archived: false, userId: "u1", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
];

describe("PullToSearch", () => {
  it("does not render when not active", () => {
    const { container } = render(
      ce(PullToSearch, { todos: mockTodos, projects: mockProjects, onSelectResult: () => {} }),
    );
    expect(container.firstChild).toBeNull();
  });

  it("accepts required props without crashing", () => {
    const { container } = render(
      ce(PullToSearch, {
        todos: mockTodos,
        projects: mockProjects,
        onSelectResult: () => {},
      }),
    );
    // Component renders without throwing
    expect(container.firstChild).toBeNull(); // Not active initially
  });

  it("accepts empty todos and projects", () => {
    const { container } = render(
      ce(PullToSearch, { todos: [], projects: [], onSelectResult: () => {} }),
    );
    expect(container.firstChild).toBeNull();
  });
});
