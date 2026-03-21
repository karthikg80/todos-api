// =============================================================================
// drawer feature barrel — re-exports from drawerUi.js and drawerStore.js
//
// New code should import from this barrel:
//   import { openTodoDrawer, closeTodoDrawer } from '../features/drawer/index.js';
//
// The drawerUi.js monolith (2,146 lines) will be split incrementally:
// - drawerView.js (rendering)
// - drawerDraft.js (draft management)
// - drawerKebab.js (kebab menu)
// - drawerAssist.js (AI suggestions)
// =============================================================================

export {
  // Drawer lifecycle
  openTodoDrawer,
  closeTodoDrawer,
  syncTodoDrawerStateWithRender,
  toggleDrawerDetailsPanel,
  deleteTodoFromDrawer,
  getTodoDrawerElements,
  initializeDrawerDraft,
  setDrawerSaveState,
  lockBodyScrollForDrawer,
  unlockBodyScrollForDrawer,
  bindTodoDrawerHandlers,
  // Drawer event handlers
  onDrawerTitleInput,
  onDrawerTitleBlur,
  onDrawerTitleKeydown,
  onDrawerCompletedChange,
  onDrawerDueDateChange,
  onDrawerProjectChange,
  onDrawerPriorityChange,
  onDrawerDescriptionInput,
  onDrawerDescriptionBlur,
  onDrawerDescriptionKeydown,
  onDrawerNotesInput,
  onDrawerNotesBlur,
  onDrawerNotesKeydown,
  onDrawerCategoryInput,
  onDrawerCategoryBlur,
  renderTodoDrawerContent,
  saveDrawerPatch,
  // Kebab menu
  getKebabTriggerForTodo,
  closeTodoKebabMenu,
  toggleTodoKebab,
  openTodoFromKebab,
  openEditTodoFromKebab,
  openDrawerDangerZone,
  // Task drawer assist
  markTaskDrawerDismissed,
  clearTaskDrawerDismissed,
  isTaskDrawerDismissed,
  resetTaskDrawerAssistState,
  loadTaskDrawerDecisionAssist,
  applyTaskDrawerSuggestion,
  dismissTaskDrawerSuggestions,
  undoTaskDrawerSuggestion,
} from "../../modules/drawerUi.js";

export {
  getDrawerState,
  isDrawerOpen,
  getDrawerEntityId,
  isDrawerDetailsExpanded,
} from "./drawerStore.js";
