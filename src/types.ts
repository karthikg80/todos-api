export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  category?: string;
  dueDate?: Date;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTodoDto {
  title: string;
  description?: string;
  category?: string;
  dueDate?: Date;
}

export interface UpdateTodoDto {
  title?: string;
  description?: string;
  completed?: boolean;
  category?: string | null;
  dueDate?: Date | null;
}
