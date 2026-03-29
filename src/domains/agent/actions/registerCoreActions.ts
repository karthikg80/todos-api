import type { ActionRegistry } from "./actionRegistry";
import { registerTasksReadActions } from "./tasksReadActions";
import { registerProjectsReadActions } from "./projectsReadActions";
import { registerViewListActions } from "./viewListActions";
import { registerSystemReadActions } from "./systemReadActions";
import { registerTaskWriteActions } from "./taskWriteActions";
import { registerProjectWriteActions } from "./projectWriteActions";
import { registerGoalAreaActions } from "./goalAreaActions";
import { registerCaptureActions } from "./captureActions";
import { registerAgentControlActions } from "./agentControlActions";

export function registerCoreActions(registry: ActionRegistry): void {
  registerTasksReadActions(registry);
  registerProjectsReadActions(registry);
  registerViewListActions(registry);
  registerSystemReadActions(registry);
  registerTaskWriteActions(registry);
  registerProjectWriteActions(registry);
  registerGoalAreaActions(registry);
  registerCaptureActions(registry);
  registerAgentControlActions(registry);
}
