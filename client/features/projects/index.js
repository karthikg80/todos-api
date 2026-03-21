// =============================================================================
// projects feature barrel — re-exports from projectsState.js and initProjectsFeature.js
//
// New code should import from this barrel:
//   import { loadProjects, createProject } from '../features/projects/index.js';
//
// The projectsState.js monolith (1,391 lines) will be split incrementally:
// - projectCrud.js (create/rename/delete/archive)
// - projectHeadings.js (heading management)
// - projectCatalog.js (catalog refresh, rail data)
// - projectDialogs.js (edit drawer + delete dialog)
// =============================================================================

export {
  // CRUD
  loadCustomProjects,
  saveCustomProjects,
  loadProjects,
  createProject,
  createSubproject,
  renameProjectByName,
  deleteProjectByName,
  archiveProject,
  unarchiveProject,
  createProjectByName,
  // Selection
  getSelectedProjectRecord,
  getProjectRecordByName,
  updateCategoryFilter,
  // Headings
  getProjectHeadings,
  loadHeadingsForProject,
  scheduleLoadSelectedProjectHeadings,
  createHeadingForSelectedProject,
  renderProjectHeadingCreateButton,
  // Catalog
  getAllProjects,
  getProjectsForRail,
  refreshProjectCatalog,
  buildOpenTodoCountMapByProject,
  updateProjectSelectOptions,
  renderProjectOptions,
  // Project edit drawer
  openProjectEditDrawer,
  closeProjectEditDrawer,
  submitProjectEditDrawer,
  // Project delete dialog
  openProjectDeleteDialog,
  closeProjectDeleteDialog,
  confirmDeleteSelectedProject,
  // Project CRUD modal
  openProjectCrudModal,
  closeProjectCrudModal,
  submitProjectCrudModal,
} from "../../modules/projectsState.js";

export {
  initProjectsFeature,
  moveProjectHeading,
  reorderProjectHeadings,
  moveTodoToHeading,
} from "./initProjectsFeature.js";
