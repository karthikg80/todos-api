import type { Heading, Todo } from "../../types";

export type FlatItem =
  | {
      id: string;
      sortableId: string;
      kind: "heading";
      heading: Heading;
      parentHeadingId: string | null;
    }
  | {
      id: string;
      sortableId: string;
      kind: "todo";
      todo: Todo;
      parentHeadingId: string | null;
    };

export function sortByOrder<
  T extends { order?: number; sortOrder?: number; createdAt?: string },
>(items: T[], orderKey: "order" | "sortOrder") {
  return [...items].sort((a, b) => {
    const aOrder = orderKey === "order" ? (a.order ?? 0) : (a.sortOrder ?? 0);
    const bOrder = orderKey === "order" ? (b.order ?? 0) : (b.sortOrder ?? 0);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));
  });
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function buildFlatItems(headings: Heading[], todos: Todo[]) {
  const sortedHeadings = sortByOrder(headings, "sortOrder");
  const sortedTodos = sortByOrder(todos, "order");
  const todosByHeading = new Map<string | null, Todo[]>();

  for (const todo of sortedTodos) {
    const key = todo.headingId ?? null;
    const existing = todosByHeading.get(key) ?? [];
    existing.push(todo);
    todosByHeading.set(key, existing);
  }

  const flat: FlatItem[] = [];
  for (const todo of todosByHeading.get(null) ?? []) {
    flat.push({
      id: todo.id,
      sortableId: `todo:${todo.id}`,
      kind: "todo",
      todo,
      parentHeadingId: null,
    });
  }

  for (const heading of sortedHeadings) {
    flat.push({
      id: heading.id,
      sortableId: `heading:${heading.id}`,
      kind: "heading",
      heading,
      parentHeadingId: null,
    });

    for (const todo of todosByHeading.get(heading.id) ?? []) {
      flat.push({
        id: todo.id,
        sortableId: `todo:${todo.id}`,
        kind: "todo",
        todo,
        parentHeadingId: heading.id,
      });
    }
  }

  return {
    sortedHeadings,
    sortedTodos,
    flatItems: flat,
    backlogTodos: todosByHeading.get(null) ?? [],
    todosByHeading,
  };
}
