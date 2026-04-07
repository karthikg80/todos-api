// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FieldRenderer } from "./FieldRenderer";
import type { Todo, Project, Heading } from "../../types";
import type { FieldDef } from "../../types/fieldLayout";

const makeTodo = (overrides: Partial<Todo> = {}): Todo => ({
  id: "todo-1",
  title: "Test task",
  description: overrides.description ?? null,
  notes: overrides.notes ?? null,
  status: overrides.status ?? "next",
  completed: overrides.completed ?? false,
  completedAt: overrides.completedAt ?? null,
  projectId: overrides.projectId ?? null,
  category: overrides.category ?? null,
  headingId: overrides.headingId ?? null,
  tags: overrides.tags ?? [],
  context: overrides.context ?? null,
  energy: overrides.energy ?? null,
  dueDate: overrides.dueDate ?? null,
  startDate: overrides.startDate ?? null,
  scheduledDate: overrides.scheduledDate ?? null,
  reviewDate: overrides.reviewDate ?? null,
  doDate: overrides.doDate ?? null,
  estimateMinutes: overrides.estimateMinutes ?? null,
  waitingOn: overrides.waitingOn ?? null,
  dependsOnTaskIds: overrides.dependsOnTaskIds ?? [],
  order: overrides.order ?? 0,
  priority: overrides.priority ?? null,
  archived: overrides.archived ?? false,
  firstStep: overrides.firstStep ?? null,
  emotionalState: overrides.emotionalState ?? null,
  effortScore: overrides.effortScore ?? null,
  source: overrides.source ?? null,
  recurrence: overrides.recurrence ?? null,
  subtasks: overrides.subtasks ?? undefined,
  userId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const defaultTodo = makeTodo();
const defaultProjects: Project[] = [
  { id: "p1", name: "Work", status: "active", archived: false, userId: "user-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "p2", name: "Personal", status: "active", archived: false, userId: "user-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];
const defaultHeadings: Heading[] = [
  { id: "h1", projectId: "p1", name: "Planning", sortOrder: 0 },
  { id: "h2", projectId: "p1", name: "Execution", sortOrder: 1 },
];

const makeFieldDef = (base: Partial<FieldDef> & Pick<FieldDef, 'key' | 'label' | 'type' | 'group'>): FieldDef => ({
  defaultTier: 1,
  ...base,
});

describe("FieldRenderer - variant dispatch", () => {
  const renderField = (fieldDef: FieldDef, todo: Todo = defaultTodo) =>
    render(createElement(FieldRenderer, {
      fieldDef,
      todo,
      projects: defaultProjects,
      headings: defaultHeadings,
      onSave: vi.fn(),
    }));

  it("renders chips variant", () => {
    const fieldDef = makeFieldDef({
      key: "priority",
      label: "Priority",
      type: "select",
      variant: "chips",
      group: "status",
      options: [
        { value: "low", label: "Low", tone: "muted" as const },
        { value: "medium", label: "Medium", tone: "info" as const },
        { value: "high", label: "High", tone: "warn" as const },
        { value: "urgent", label: "Urgent", tone: "danger" as const },
      ],
    });
    renderField(fieldDef, makeTodo({ priority: "medium" }));
    expect(screen.getByRole("radiogroup", { name: "Priority" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Medium", checked: true })).toBeTruthy();
  });

  it("renders select variant with project options", () => {
    const fieldDef = makeFieldDef({
      key: "projectId",
      label: "Project",
      type: "select",
      group: "project",
    });
    const { container } = renderField(fieldDef, makeTodo({ projectId: "p1" }));
    const select = container.querySelector("#field-projectId");
    expect(select).toBeTruthy();
    expect(container.querySelector("option[value='p1']")).toBeTruthy();
    expect(container.querySelector("option[value='p2']")).toBeTruthy();
  });

  it("renders select variant with heading options", () => {
    const fieldDef = makeFieldDef({
      key: "headingId",
      label: "Heading",
      type: "select",
      group: "project",
    });
    const { container } = renderField(fieldDef, makeTodo({ headingId: "h1" }));
    const select = container.querySelector("#field-headingId");
    expect(select).toBeTruthy();
    expect(container.querySelector("option[value='h1']")).toBeTruthy();
    expect(container.querySelector("option[value='h2']")).toBeTruthy();
  });

  it("renders date variant", () => {
    const fieldDef = makeFieldDef({
      key: "dueDate",
      label: "Due date",
      type: "date",
      group: "dates",
    });
    const { container } = renderField(fieldDef, makeTodo({ dueDate: "2026-05-01T00:00:00.000Z" }));
    const input = container.querySelector("#field-dueDate");
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("2026-05-01");
  });

  it("renders number variant", () => {
    const fieldDef = makeFieldDef({
      key: "estimateMinutes",
      label: "Estimate",
      type: "number",
      group: "planning",
    });
    const { container } = renderField(fieldDef, makeTodo({ estimateMinutes: 30 }));
    const input = container.querySelector("#field-estimateMinutes");
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("30");
  });

  it("renders textarea variant", () => {
    const fieldDef = makeFieldDef({
      key: "notes",
      label: "Notes",
      type: "textarea",
      group: "planning",
      fullWidth: true,
    });
    const { container } = renderField(fieldDef, makeTodo({ notes: "Some notes" }));
    const textarea = container.querySelector("#field-notes");
    expect(textarea).toBeTruthy();
    expect((textarea as HTMLTextAreaElement).value).toBe("Some notes");
  });

  it("renders text variant (default)", () => {
    const fieldDef = makeFieldDef({
      key: "title",
      label: "Title",
      type: "text",
      group: "status",
    });
    const { container } = renderField(fieldDef);
    const input = container.querySelector("#field-title");
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("Test task");
  });

  it("renders date-shortcuts variant", () => {
    const fieldDef = makeFieldDef({
      key: "dueDate",
      label: "Due date",
      type: "date",
      variant: "date-shortcuts",
      group: "dates",
    });
    const { container } = renderField(fieldDef, makeTodo({ dueDate: "2026-05-01T00:00:00.000Z" }));
    const input = container.querySelector("#field-dueDate");
    expect(input).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Tomorrow")).toBeTruthy();
  });

  it("renders collapsible variant when empty", () => {
    const fieldDef = makeFieldDef({
      key: "firstStep",
      label: "First step",
      type: "textarea",
      variant: "collapsible",
      group: "planning",
      emptyPrompt: "Add first step...",
    });
    renderField(fieldDef);
    expect(screen.getByRole("button", { name: /Add first step/ })).toBeTruthy();
  });

  it("renders collapsible variant when has value", () => {
    const fieldDef = makeFieldDef({
      key: "firstStep",
      label: "First step",
      type: "textarea",
      variant: "collapsible",
      group: "planning",
    });
    const { container } = renderField(fieldDef, makeTodo({ firstStep: "Open the door" }));
    const textarea = container.querySelector("#field-firstStep");
    expect(textarea).toBeTruthy();
    expect((textarea as HTMLTextAreaElement).value).toBe("Open the door");
  });

  it("renders presets variant", () => {
    const fieldDef = makeFieldDef({
      key: "estimateMinutes",
      label: "Estimate",
      type: "number",
      variant: "presets",
      group: "planning",
      presets: [
        { value: 15, label: "15m" },
        { value: 30, label: "30m" },
        { value: 60, label: "1h" },
      ],
    });
    renderField(fieldDef, makeTodo({ estimateMinutes: 30 }));
    expect(screen.getByRole("button", { name: "30m" })).toBeTruthy();
  });
});

describe("FieldRenderer - onSave behavior", () => {
  it("calls onSave when select value changes", () => {
    const onSave = vi.fn();
    const fieldDef = makeFieldDef({
      key: "priority",
      label: "Priority",
      type: "select",
      group: "status",
      options: [
        { value: "low", label: "Low" },
        { value: "high", label: "High" },
      ],
    });
    const { container } = render(createElement(FieldRenderer, {
      fieldDef,
      todo: defaultTodo,
      onSave,
    }));
    const select = container.querySelector("#field-priority") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "high" } });
    expect(onSave).toHaveBeenCalledWith("priority", "high");
  });

  it("calls onSave when date value changes", () => {
    const onSave = vi.fn();
    const fieldDef = makeFieldDef({
      key: "dueDate",
      label: "Due date",
      type: "date",
      group: "dates",
    });
    const { container } = render(createElement(FieldRenderer, {
      fieldDef,
      todo: defaultTodo,
      onSave,
    }));
    const input = container.querySelector("#field-dueDate") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-06-15" } });
    expect(onSave).toHaveBeenCalledWith("dueDate", "2026-06-15");
  });

  it("calls onSave when number value blurs with change", () => {
    const onSave = vi.fn();
    const fieldDef = makeFieldDef({
      key: "estimateMinutes",
      label: "Estimate",
      type: "number",
      group: "planning",
    });
    const { container } = render(createElement(FieldRenderer, {
      fieldDef,
      todo: makeTodo({ estimateMinutes: 30 }),
      onSave,
    }));
    const input = container.querySelector("#field-estimateMinutes") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "60" } });
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledWith("estimateMinutes", 60);
  });

  it("does not call onSave when number value blurs without change", () => {
    const onSave = vi.fn();
    const fieldDef = makeFieldDef({
      key: "estimateMinutes",
      label: "Estimate",
      type: "number",
      group: "planning",
    });
    const { container } = render(createElement(FieldRenderer, {
      fieldDef,
      todo: makeTodo({ estimateMinutes: 30 }),
      onSave,
    }));
    const input = container.querySelector("#field-estimateMinutes") as HTMLInputElement;
    fireEvent.blur(input);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onSave when text value blurs with change", () => {
    const onSave = vi.fn();
    const fieldDef = makeFieldDef({
      key: "title",
      label: "Title",
      type: "text",
      group: "status",
    });
    const { container } = render(createElement(FieldRenderer, {
      fieldDef,
      todo: defaultTodo,
      onSave,
    }));
    const input = container.querySelector("#field-title") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New title" } });
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledWith("title", "New title");
  });

  it("calls onSave when textarea value blurs with change", () => {
    const onSave = vi.fn();
    const fieldDef = makeFieldDef({
      key: "notes",
      label: "Notes",
      type: "textarea",
      group: "planning",
    });
    const { container } = render(createElement(FieldRenderer, {
      fieldDef,
      todo: makeTodo({ notes: "Old notes" }),
      onSave,
    }));
    const textarea = container.querySelector("#field-notes") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "New notes" } });
    fireEvent.blur(textarea);
    expect(onSave).toHaveBeenCalledWith("notes", "New notes");
  });
});

describe("FieldRenderer - special fields", () => {
  it("renders archived field with correct value", () => {
    const fieldDef = makeFieldDef({
      key: "archived",
      label: "Archived",
      type: "select",
      variant: "chips",
      group: "advanced",
      options: [
        { value: "false", label: "No" },
        { value: "true", label: "Yes" },
      ],
    });
    render(createElement(FieldRenderer, {
      fieldDef,
      todo: makeTodo({ archived: true }),
      onSave: vi.fn(),
    }));

    expect(screen.getByRole("radio", { name: "Yes", checked: true })).toBeTruthy();
  });

  it("renders effortScore field", () => {
    const fieldDef = makeFieldDef({
      key: "effortScore",
      label: "Effort",
      type: "number",
      group: "planning",
    });
    const { container } = render(createElement(FieldRenderer, {
      fieldDef,
      todo: makeTodo({ effortScore: 3 }),
      onSave: vi.fn(),
    }));
    const input = container.querySelector("#field-effortScore");
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("3");
  });

  it("filters out archived projects from project select", () => {
    const fieldDef = makeFieldDef({
      key: "projectId",
      label: "Project",
      type: "select",
      group: "project",
    });
    const projects: Project[] = [
      { id: "p1", name: "Active", status: "active", archived: false, userId: "user-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "p2", name: "Archived", status: "active", archived: true, userId: "user-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    render(createElement(FieldRenderer, {
      fieldDef,
      todo: defaultTodo,
      projects,
      onSave: vi.fn(),
    }));

    expect(screen.getByRole("option", { name: "Active" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Archived" })).toBeNull();
  });
});

describe("FieldRenderer - compact mode", () => {
  it("applies compact class when compact prop is true", () => {
    const fieldDef = makeFieldDef({
      key: "title",
      label: "Title",
      type: "text",
      group: "status",
    });
    const { container } = render(createElement(FieldRenderer, {
      fieldDef,
      todo: defaultTodo,
      compact: true,
      onSave: vi.fn(),
    }));

    expect(container.querySelector(".todo-drawer__field--half")).toBeTruthy();
  });

  it("applies compact class when fieldDef.compact is true", () => {
    const fieldDef = makeFieldDef({
      key: "title",
      label: "Title",
      type: "text",
      compact: true,
      group: "status",
    });
    const { container } = render(createElement(FieldRenderer, {
      fieldDef,
      todo: defaultTodo,
      onSave: vi.fn(),
    }));

    expect(container.querySelector(".todo-drawer__field--half")).toBeTruthy();
  });
});

describe("FieldRenderer - hints and placeholders", () => {
  it("shows hint when value is empty", () => {
    const fieldDef = makeFieldDef({
      key: "context",
      label: "Context",
      type: "text",
      hint: "Where will this happen?",
      group: "project",
    });
    render(createElement(FieldRenderer, {
      fieldDef,
      todo: defaultTodo,
      onSave: vi.fn(),
    }));

    expect(screen.getByText("Where will this happen?")).toBeTruthy();
  });

  it("hides hint when value is present", () => {
    const fieldDef = makeFieldDef({
      key: "context",
      label: "Context",
      type: "text",
      hint: "Where will this happen?",
      group: "project",
    });
    render(createElement(FieldRenderer, {
      fieldDef,
      todo: makeTodo({ context: "@home" }),
      onSave: vi.fn(),
    }));

    expect(screen.queryByText("Where will this happen?")).toBeNull();
  });

  it("shows context placeholder", () => {
    const fieldDef = makeFieldDef({
      key: "context",
      label: "Context",
      type: "text",
      group: "project",
    });
    render(createElement(FieldRenderer, {
      fieldDef,
      todo: defaultTodo,
      onSave: vi.fn(),
    }));

    expect(screen.getByPlaceholderText("Where? @home, @office, @errands...")).toBeTruthy();
  });

  it("shows waitingOn placeholder", () => {
    const fieldDef = makeFieldDef({
      key: "waitingOn",
      label: "Waiting on",
      type: "text",
      group: "project",
    });
    render(createElement(FieldRenderer, {
      fieldDef,
      todo: defaultTodo,
      onSave: vi.fn(),
    }));

    expect(screen.getByPlaceholderText("Person or thing blocking this")).toBeTruthy();
  });

  it("shows firstStep placeholder", () => {
    const fieldDef = makeFieldDef({
      key: "firstStep",
      label: "First step",
      type: "text",
      group: "planning",
    });
    render(createElement(FieldRenderer, {
      fieldDef,
      todo: defaultTodo,
      onSave: vi.fn(),
    }));

    expect(screen.getByPlaceholderText("The smallest next action...")).toBeTruthy();
  });
});

describe("FieldRenderer - recurrence fields", () => {
  it("reads recurrenceType from todo.recurrence.type", () => {
    const fieldDef = makeFieldDef({
      key: "recurrenceType",
      label: "Repeat",
      type: "select",
      group: "dates",
      options: [
        { value: "none", label: "Never" },
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly" },
      ],
    });
    render(createElement(FieldRenderer, {
      fieldDef,
      todo: makeTodo({ recurrence: { type: "weekly", interval: 1 } }),
      onSave: vi.fn(),
    }));

    expect(screen.getByRole("option", { name: "Weekly", selected: true })).toBeTruthy();
  });

  it("reads recurrenceInterval from todo.recurrence.interval", () => {
    const fieldDef = makeFieldDef({
      key: "recurrenceInterval",
      label: "Every",
      type: "number",
      group: "dates",
    });
    render(createElement(FieldRenderer, {
      fieldDef,
      todo: makeTodo({ recurrence: { type: "weekly", interval: 2 } }),
      onSave: vi.fn(),
    }));

    expect(screen.getByRole("spinbutton")).toHaveValue(2);
  });
});
