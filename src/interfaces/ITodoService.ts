import { Todo, CreateTodoDto, UpdateTodoDto } from '../types';

/**
 * Interface defining the contract for Todo service implementations.
 * All methods are async to support both in-memory and database operations.
 */
export interface ITodoService {
  /**
   * Create a new todo item
   * @param dto - Data transfer object containing todo details
   * @returns Promise resolving to the created todo
   */
  create(dto: CreateTodoDto): Promise<Todo>;

  /**
   * Retrieve all todo items
   * @returns Promise resolving to array of all todos
   */
  findAll(): Promise<Todo[]>;

  /**
   * Find a todo by its ID
   * @param id - The todo ID to search for
   * @returns Promise resolving to the todo if found, null otherwise
   */
  findById(id: string): Promise<Todo | null>;

  /**
   * Update an existing todo
   * @param id - The todo ID to update
   * @param dto - Data transfer object containing updated fields
   * @returns Promise resolving to updated todo if found, null otherwise
   */
  update(id: string, dto: UpdateTodoDto): Promise<Todo | null>;

  /**
   * Delete a todo by ID
   * @param id - The todo ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Clear all todos (primarily for testing)
   * @returns Promise resolving when operation completes
   */
  clear(): Promise<void>;
}
