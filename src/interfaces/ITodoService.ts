import { Todo, CreateTodoDto, UpdateTodoDto } from '../types';

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
   * Clear all todos (primarily for testing)
   * @returns Promise resolving when operation completes
   */
  clear(): Promise<void>;
}
