import {
  Todo,
  Subtask,
  CreateTodoDto,
  UpdateTodoDto,
  CreateSubtaskDto,
  UpdateSubtaskDto,
  ReorderTodoItemDto,
} from '../types';

/**
 * Interface defining the contract for Todo service implementations.
 * All methods are async to support both in-memory and database operations.
 */
export interface ITodoService {
  /**
   * Create a new todo item
   * @param userId - The user ID who owns the todo
   * @param dto - Data transfer object containing todo details
   * @returns Promise resolving to the created todo
   */
  create(userId: string, dto: CreateTodoDto): Promise<Todo>;

  /**
   * Retrieve all todo items for a user
   * @param userId - The user ID to filter todos by
   * @returns Promise resolving to array of user's todos
   */
  findAll(userId: string): Promise<Todo[]>;

  /**
   * Find a todo by its ID (belonging to the specified user)
   * @param userId - The user ID who owns the todo
   * @param id - The todo ID to search for
   * @returns Promise resolving to the todo if found, null otherwise
   */
  findById(userId: string, id: string): Promise<Todo | null>;

  /**
   * Update an existing todo (belonging to the specified user)
   * @param userId - The user ID who owns the todo
   * @param id - The todo ID to update
   * @param dto - Data transfer object containing updated fields
   * @returns Promise resolving to updated todo if found, null otherwise
   */
  update(userId: string, id: string, dto: UpdateTodoDto): Promise<Todo | null>;

  /**
   * Delete a todo by ID (belonging to the specified user)
   * @param userId - The user ID who owns the todo
   * @param id - The todo ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  delete(userId: string, id: string): Promise<boolean>;

  /**
   * Reorder multiple todos for a user atomically when possible
   * @param userId - The user ID who owns the todos
   * @param items - Ordered list of todo IDs and target order values
   * @returns Promise resolving to reordered todos or null if any todo is missing
   */
  reorder(userId: string, items: ReorderTodoItemDto[]): Promise<Todo[] | null>;

  /**
   * Get all subtasks for a todo
   */
  findSubtasks(userId: string, todoId: string): Promise<Subtask[] | null>;

  /**
   * Create a subtask under a todo
   */
  createSubtask(userId: string, todoId: string, dto: CreateSubtaskDto): Promise<Subtask | null>;

  /**
   * Update a specific subtask
   */
  updateSubtask(
    userId: string,
    todoId: string,
    subtaskId: string,
    dto: UpdateSubtaskDto
  ): Promise<Subtask | null>;

  /**
   * Delete a specific subtask
   */
  deleteSubtask(userId: string, todoId: string, subtaskId: string): Promise<boolean>;

  /**
   * Clear all todos (primarily for testing)
   * @returns Promise resolving when operation completes
   */
  clear(): Promise<void>;
}
