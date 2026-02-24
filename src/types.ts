export type Priority = "low" | "medium" | "high";
export type TodoSortBy =
  | "order"
  | "createdAt"
  | "updatedAt"
  | "dueDate"
  | "priority"
  | "title";
export type SortOrder = "asc" | "desc";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  todoId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  todoCount?: number;
}

export interface Heading {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  category?: string;
  headingId?: string;
  dueDate?: Date;
  order: number;
  priority: Priority;
  notes?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  subtasks?: Subtask[];
}

export interface CreateProjectDto {
  name: string;
}

export interface UpdateProjectDto {
  name: string;
}

export interface CreateHeadingDto {
  name: string;
}

export interface CreateTodoDto {
  title: string;
  description?: string;
  category?: string;
  headingId?: string | null;
  dueDate?: Date;
  priority?: Priority;
  notes?: string;
}

export interface UpdateTodoDto {
  title?: string;
  description?: string;
  completed?: boolean;
  category?: string | null;
  headingId?: string | null;
  dueDate?: Date | null;
  order?: number;
  priority?: Priority;
  notes?: string | null;
}

export interface CreateSubtaskDto {
  title: string;
}

export interface UpdateSubtaskDto {
  title?: string;
  completed?: boolean;
  order?: number;
}

export interface ReorderTodoItemDto {
  id: string;
  order: number;
}

export interface FindTodosQuery {
  completed?: boolean;
  priority?: Priority;
  category?: string;
  sortBy?: TodoSortBy;
  sortOrder?: SortOrder;
  page?: number;
  limit?: number;
}
