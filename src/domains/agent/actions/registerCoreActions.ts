import type { ActionRegistry } from "./actionRegistry";
import { registerTasksReadActions } from "./tasksReadActions";
import { registerProjectsReadActions } from "./projectsReadActions";
import { registerViewListActions } from "./viewListActions";
import { registerSystemReadActions } from "./systemReadActions";

export function registerCoreActions(registry: ActionRegistry): void {
  registerTasksReadActions(registry);
  registerProjectsReadActions(registry);
  registerViewListActions(registry);
  registerSystemReadActions(registry);
}
