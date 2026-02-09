export type Priority = "low" | "medium" | "high";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  todoId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  category?: string;
  dueDate?: Date;
  order: number;
  priority: Priority;
  notes?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  subtasks?: Subtask[];
}

export interface CreateTodoDto {
  title: string;
  description?: string;
  category?: string;
  dueDate?: Date;
  priority?: Priority;
  notes?: string;
}

export interface UpdateTodoDto {
  title?: string;
  description?: string;
  completed?: boolean;
  category?: string | null;
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
