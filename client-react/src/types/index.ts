export interface Todo {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  status: TodoStatus;
  completed: boolean;
  completedAt?: string | null;
  projectId?: string | null;
  category?: string | null;
  headingId?: string | null;
  tags: string[];
  context?: string | null;
  energy?: "low" | "medium" | "high" | null;
  dueDate?: string | null;
  startDate?: string | null;
  scheduledDate?: string | null;
  reviewDate?: string | null;
  doDate?: string | null;
  estimateMinutes?: number | null;
  waitingOn?: string | null;
  dependsOnTaskIds: string[];
  order: number;
  priority?: Priority | null;
  archived: boolean;
  firstStep?: string | null;
  emotionalState?: string | null;
  effortScore?: number | null;
  source?: string | null;
  subtasks?: Subtask[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export type TodoStatus =
  | "inbox"
  | "next"
  | "in_progress"
  | "waiting"
  | "scheduled"
  | "someday"
  | "done"
  | "cancelled";

export type Priority = "low" | "medium" | "high" | "urgent";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  completedAt?: string | null;
  todoId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: "active" | "on_hold" | "completed" | "archived";
  priority?: Priority | null;
  archived: boolean;
  todoCount?: number;
  openTodoCount?: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Heading {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  isVerified?: boolean;
  plan?: string;
}

export interface CreateTodoDto {
  title: string;
  description?: string | null;
  status?: TodoStatus;
  completed?: boolean;
  projectId?: string | null;
  category?: string | null;
  dueDate?: string | null;
  priority?: Priority | null;
  tags?: string[];
}

export interface UpdateTodoDto {
  title?: string;
  description?: string | null;
  status?: TodoStatus;
  completed?: boolean;
  projectId?: string | null;
  category?: string | null;
  dueDate?: string | null;
  priority?: Priority | null;
  tags?: string[];
  notes?: string | null;
  firstStep?: string | null;
  energy?: "low" | "medium" | "high" | null;
  estimateMinutes?: number | null;
  waitingOn?: string | null;
  context?: string | null;
  emotionalState?: string | null;
}
