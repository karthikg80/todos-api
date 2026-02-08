import {
  CreateTodoDto,
  UpdateTodoDto,
  ReorderTodoItemDto,
} from './types';

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

  if (data.priority !== undefined) {
    if (typeof data.priority !== 'string') {
      throw new ValidationError('Priority must be a string');
    }
    if (!['low', 'medium', 'high'].includes(data.priority.toLowerCase())) {
      throw new ValidationError('Priority must be low, medium, or high');
    }
  }

  if (data.notes !== undefined) {
    if (typeof data.notes !== 'string') {
      throw new ValidationError('Notes must be a string');
    }
    if (data.notes.length > 10000) {
      throw new ValidationError('Notes cannot exceed 10000 characters');
    }
  }

  return {
    title: data.title.trim(),
    description: data.description?.trim(),
    category: data.category?.trim(),
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    priority: data.priority?.toLowerCase(),
    notes: data.notes?.trim()
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

  if (data.order !== undefined) {
    if (typeof data.order !== 'number') {
      throw new ValidationError('Order must be a number');
    }
    if (data.order < 0 || !Number.isInteger(data.order)) {
      throw new ValidationError('Order must be a non-negative integer');
    }
    update.order = data.order;
  }

  if (data.priority !== undefined) {
    if (data.priority === null) {
      update.priority = 'medium' as any; // Reset to default
    } else {
      if (typeof data.priority !== 'string') {
        throw new ValidationError('Priority must be a string');
      }
      if (!['low', 'medium', 'high'].includes(data.priority.toLowerCase())) {
        throw new ValidationError('Priority must be low, medium, or high');
      }
      update.priority = data.priority.toLowerCase() as any;
    }
  }

  if (data.notes !== undefined) {
    if (data.notes === null) {
      update.notes = null;
    } else {
      if (typeof data.notes !== 'string') {
        throw new ValidationError('Notes must be a string');
      }
      if (data.notes.length > 10000) {
        throw new ValidationError('Notes cannot exceed 10000 characters');
      }
      update.notes = data.notes.trim();
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

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(id)) {
    throw new ValidationError('Invalid ID format');
  }
}

export function validateReorderTodos(data: any): ReorderTodoItemDto[] {
  if (!Array.isArray(data)) {
    throw new ValidationError('Request body must be an array');
  }

  if (data.length === 0) {
    throw new ValidationError('At least one todo order item is required');
  }

  const seenIds = new Set<string>();
  const items = data.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new ValidationError(`Item at index ${index} must be an object`);
    }

    const id = item.id;
    const order = item.order;
    if (typeof id !== 'string') {
      throw new ValidationError(`Item at index ${index} has invalid id`);
    }
    validateId(id);

    if (typeof order !== 'number' || !Number.isInteger(order) || order < 0) {
      throw new ValidationError(`Item at index ${index} has invalid order`);
    }

    if (seenIds.has(id)) {
      throw new ValidationError('Duplicate todo IDs are not allowed');
    }
    seenIds.add(id);

    return { id, order };
  });

  return items;
}

export function validateCreateSubtask(data: any) {
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

  return {
    title: data.title.trim(),
  };
}

export function validateUpdateSubtask(data: any) {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Request body must be an object');
  }

  const update: any = {};

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

  if (data.completed !== undefined) {
    if (typeof data.completed !== 'boolean') {
      throw new ValidationError('Completed must be a boolean');
    }
    update.completed = data.completed;
  }

  if (data.order !== undefined) {
    if (typeof data.order !== 'number') {
      throw new ValidationError('Order must be a number');
    }
    if (data.order < 0 || !Number.isInteger(data.order)) {
      throw new ValidationError('Order must be a non-negative integer');
    }
    update.order = data.order;
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError('At least one field must be provided for update');
  }

  return update;
}
