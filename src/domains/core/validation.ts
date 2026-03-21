/**
 * Core domain validators — todo, project, user action input validation.
 *
 * Re-exports from the monolithic agentValidation.ts for domain-scoped imports.
 */
export {
  // Tasks
  validateAgentListTasksInput,
  validateAgentSearchTasksInput,
  validateAgentGetTaskInput,
  validateAgentCreateTaskInput,
  validateAgentUpdateTaskInput,
  validateAgentCompleteTaskInput,
  validateAgentArchiveTaskInput,
  validateAgentDeleteTaskInput,
  validateAgentAddSubtaskInput,
  validateAgentUpdateSubtaskInput,
  validateAgentDeleteSubtaskInput,
  validateAgentMoveTaskToProjectInput,
  // Projects
  validateAgentListProjectsInput,
  validateAgentCreateProjectInput,
  validateAgentGetProjectInput,
  validateAgentUpdateProjectInput,
  validateAgentRenameProjectInput,
  validateAgentDeleteProjectInput,
  validateAgentArchiveProjectInput,
} from "../../validation/agentValidation";
