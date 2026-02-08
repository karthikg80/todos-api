import { CreateTodoDto, UpdateTodoDto } from './types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateCreateTodo(data: any): CreateTodoDto {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Request body must be an object');
  }

  if (!data.title || typeof data.title !== 'string') {
    throw new ValidationError('Title is required and must be a string');
  }

  if (data.title.trim().length === 0) {
    throw new ValidationError('Title cannot be empty');
  }

  if (data.title.length > 200) {
    throw new ValidationError('Title cannot exceed 200 characters');
  }

  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      throw new ValidationError('Description must be a string');
    }
    if (data.description.length > 1000) {
      throw new ValidationError('Description cannot exceed 1000 characters');
    }
  }

  if (data.category !== undefined) {
    if (typeof data.category !== 'string') {
      throw new ValidationError('Category must be a string');
    }
    if (data.category.length > 50) {
      throw new ValidationError('Category cannot exceed 50 characters');
    }
  }

  if (data.dueDate !== undefined) {
    if (typeof data.dueDate !== 'string') {
      throw new ValidationError('Due date must be a string');
    }
    const date = new Date(data.dueDate);
    if (isNaN(date.getTime())) {
      throw new ValidationError('Invalid due date format');
    }
  }

  return {
    title: data.title.trim(),
    description: data.description?.trim(),
    category: data.category?.trim(),
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined
  };
}

export function validateUpdateTodo(data: any): UpdateTodoDto {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Request body must be an object');
  }

  const update: UpdateTodoDto = {};

  if (data.title !== undefined) {
    if (typeof data.title !== 'string') {
      throw new ValidationError('Title must be a string');
    }
    if (data.title.trim().length === 0) {
      throw new ValidationError('Title cannot be empty');
    }
    if (data.title.length > 200) {
      throw new ValidationError('Title cannot exceed 200 characters');
    }
    update.title = data.title.trim();
  }

  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      throw new ValidationError('Description must be a string');
    }
    if (data.description.length > 1000) {
      throw new ValidationError('Description cannot exceed 1000 characters');
    }
    update.description = data.description.trim();
  }

  if (data.completed !== undefined) {
    if (typeof data.completed !== 'boolean') {
      throw new ValidationError('Completed must be a boolean');
    }
    update.completed = data.completed;
  }

  if (data.category !== undefined) {
    if (data.category === null) {
      update.category = null;
    } else {
      if (typeof data.category !== 'string') {
        throw new ValidationError('Category must be a string');
      }
      if (data.category.length > 50) {
        throw new ValidationError('Category cannot exceed 50 characters');
      }
      update.category = data.category.trim();
    }
  }

  if (data.dueDate !== undefined) {
    if (data.dueDate === null) {
      update.dueDate = null;
    } else {
      if (typeof data.dueDate !== 'string') {
        throw new ValidationError('Due date must be a string');
      }
      const date = new Date(data.dueDate);
      if (isNaN(date.getTime())) {
        throw new ValidationError('Invalid due date format');
      }
      update.dueDate = date;
    }
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError('At least one field must be provided for update');
  }

  return update;
}

export function validateId(id: string): void {
  if (!id || typeof id !== 'string') {
    throw new ValidationError('Invalid ID format');
  }
}
