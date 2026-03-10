export type Priority = "low" | "medium" | "high";
export type McpScope = "read" | "write";
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
  openTodoCount?: number;
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

export type ProjectTaskDisposition = "unsorted" | "delete";

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
  headingId?: string | null;
}

export interface ReorderHeadingItemDto {
  id: string;
  sortOrder: number;
}

export interface FindTodosQuery {
  completed?: boolean;
  priority?: Priority;
  category?: string;
  search?: string;
  project?: string;
  unsorted?: boolean;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  dueDateAfter?: Date;
  dueDateBefore?: Date;
  dueDateIsNull?: boolean;
  sortBy?: TodoSortBy;
  sortOrder?: SortOrder;
  page?: number;
  limit?: number;
}
