/**
 * Core domain — Todos
 *
 * Re-exports from current service locations. As services are physically moved
 * into this directory, imports from consuming code will remain stable.
 */
export { TodoService } from "../../../services/todoService";
export { PrismaTodoService } from "../../../services/prismaTodoService";
