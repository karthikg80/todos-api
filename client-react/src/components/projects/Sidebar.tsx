import { useState, useMemo } from "react";
import type { Project } from "../../types";
import { apiCall } from "../../api/client";

// Internal keys match classic store.js currentWorkspaceView values
export type WorkspaceView =
  | "home"
  | "triage"
  | "all"
  | "today"
  | "upcoming"
  | "completed";

// Display labels match classic app-shell.fragment
const WORKSPACE_VIEWS: { key: WorkspaceView; label: string }[] = [
  { key: "home", label: "Focus" },
  { key: "triage", label: "Desk" },
  { key: "all", label: "Everything" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

// Area labels and order match classic railUi.js
const AREA_ORDER = ["home", "family", "work", "finance", "side-projects"];
const AREA_LABELS: Record<string, string> = {
  home: "Focus",
  family: "Family",
  work: "Work",
  finance: "Finance",
  "side-projects": "Side projects",
};

interface Props {
  projects: Project[];
  activeView: WorkspaceView;
  selectedProjectId: string | null;
  onSelectView: (view: WorkspaceView) => void;
  onSelectProject: (id: string | null) => void;
  onCreateProject: () => void;
  onRenameProject: (id: string, name: string) => void;
  onOpenSettings: () => void;
  onOpenAi: () => void;
  onOpenFeedback: () => void;
  onOpenAdmin: () => void;
  isAdmin: boolean;
  onRefreshProjects: () => void;
  uiMode: string;
}

export function Sidebar({
  projects,
  activeView,
  selectedProjectId,
  onSelectView,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onOpenSettings,
  onOpenAi,
  onOpenFeedback,
  onOpenAdmin,
  isAdmin,
  onRefreshProjects,
  uiMode,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const isSimple = uiMode === "simple";

  // Group active projects by area (matching classic railUi.js logic)
  const projectGroups = useMemo(() => {
    const active = projects.filter((p) => !p.archived);
    const groups = new Map<string, Project[]>();

    for (const p of active) {
      const area = (p as Project & { area?: string }).area || "";
      const list = groups.get(area) || [];
      list.push(p);
      groups.set(area, list);
    }

    // Sort: known areas first in order, then unknown alphabetically, then ungrouped last
    const sorted: Array<{ area: string; label: string; projects: Project[] }> =
      [];

    for (const area of AREA_ORDER) {
      const list = groups.get(area);
      if (list?.length) {
        sorted.push({ area, label: AREA_LABELS[area] || area, projects: list });
        groups.delete(area);
      }
    }

    // Unknown areas
    const unknownAreas = [...groups.entries()]
      .filter(([a]) => a !== "")
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [area, list] of unknownAreas) {
      sorted.push({
        area,
        label: area.charAt(0).toUpperCase() + area.slice(1),
        projects: list,
      });
    }

    // Ungrouped (no area)
    const ungrouped = groups.get("");
    if (ungrouped?.length) {
      sorted.push({ area: "", label: "", projects: ungrouped });
    }

    return sorted;
  }, [projects]);

  const handleContextMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ id: projectId, x: e.clientX, y: e.clientY });
  };

  const handleDeleteProject = async (id: string) => {
    setContextMenu(null);
    const res = await apiCall(`/projects/${id}?taskDisposition=unsorted`, {
      method: "DELETE",
    });
    if (res.ok) {
      if (selectedProjectId === id) onSelectProject(null);
      onRefreshProjects();
    }
  };

  const handleRenameProject = (id: string) => {
    const project = projects.find((p) => p.id === id);
    setContextMenu(null);
    if (project) onRenameProject(id, project.name);
  };

  const toggleArea = (area: string) => {
    setCollapsedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  };

  // Filter views based on UI mode (classic hides Focus and Desk in simple mode)
  const visibleViews = isSimple
    ? WORKSPACE_VIEWS.filter((v) => v.key !== "home" && v.key !== "triage")
    : WORKSPACE_VIEWS;

  return (
    <>
      {/* Section 1: Workspace navigation */}
      <nav className="projects-rail__primary">
        {visibleViews.map((v) => (
          <button
            key={v.key}
            className={`workspace-view-item${activeView === v.key && !selectedProjectId ? " projects-rail-item--active" : ""}`}
            data-workspace-view={v.key}
            onClick={() => {
              onSelectProject(null);
              onSelectView(v.key);
            }}
          >
            <span className="nav-label">{v.label}</span>
          </button>
        ))}
      </nav>

      {/* Section 2: Projects grouped by area */}
      <div className="projects-rail__section">
        <div className="projects-rail__section-header">
          <span className="projects-rail__section-label">Projects</span>
          <button
            id="railNewProjectBtn"
            className="projects-rail__add-btn"
            onClick={onCreateProject}
            aria-label="New project"
          >
            +
          </button>
        </div>
        <div id="projectsRailList" className="projects-rail__list">
          {projectGroups.map(({ area, label, projects: areaProjects }) => (
            <div key={area || "__ungrouped"}>
              {label && (
                <button
                  className={`projects-rail-area-header${collapsedAreas.has(area) ? " projects-rail-area-header--collapsed" : ""}`}
                  data-area-toggle={area}
                  aria-expanded={!collapsedAreas.has(area)}
                  onClick={() => toggleArea(area)}
                >
                  <span className="projects-rail-area-header__chevron">
                    {collapsedAreas.has(area) ? "▸" : "▾"}
                  </span>
                  {label}
                </button>
              )}
              {!collapsedAreas.has(area) && (
                <div
                  className="projects-rail-area-group"
                  data-area={area || undefined}
                >
                  {areaProjects.map((p) => (
                    <button
                      key={p.id}
                      className={`projects-rail-item${selectedProjectId === p.id ? " projects-rail-item--active" : ""}`}
                      data-project-key={p.name}
                      onClick={() => onSelectProject(p.id)}
                      onContextMenu={(e) => handleContextMenu(e, p.id)}
                    >
                      <span className="nav-label">{p.name}</span>
                      {p.openTodoCount != null && (
                        <span className="projects-rail-item__count">
                          {p.openTodoCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Archived projects */}
        {projects.some((p) => p.archived) && (
          <>
            <button
              className="projects-archived-toggle"
              onClick={() => setShowArchived((o) => !o)}
            >
              {showArchived ? "▾" : "▸"} Archived (
              {projects.filter((p) => p.archived).length})
            </button>
            {showArchived && (
              <div className="projects-archived-list">
                {projects
                  .filter((p) => p.archived)
                  .map((p) => (
                    <button
                      key={p.id}
                      className="projects-rail-item projects-rail-item--archived"
                      data-project-key={p.name}
                      onClick={() => onSelectProject(p.id)}
                      onContextMenu={(e) => handleContextMenu(e, p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Project context menu */}
      {contextMenu && (
        <>
          <div
            className="context-backdrop"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              className="context-menu__item"
              onClick={() => handleRenameProject(contextMenu.id)}
            >
              Rename
            </button>
            <button
              className="context-menu__item"
              onClick={async () => {
                const project = projects.find((p) => p.id === contextMenu.id);
                setContextMenu(null);
                await apiCall(`/projects/${contextMenu.id}`, {
                  method: "PUT",
                  body: JSON.stringify({ archived: !project?.archived }),
                });
                onRefreshProjects();
              }}
            >
              {projects.find((p) => p.id === contextMenu.id)?.archived
                ? "Unarchive"
                : "Archive"}
            </button>
            <button
              className="context-menu__item context-menu__item--danger"
              onClick={() => handleDeleteProject(contextMenu.id)}
            >
              Delete
            </button>
          </div>
        </>
      )}

      {/* Section 3: Utilities */}
      <div className="projects-rail__section--utilities">
        <button
          className="projects-rail-utility-item"
          onClick={onOpenAi}
        >
          ✦ AI Workspace
        </button>
        <button
          className="projects-rail-utility-item"
          onClick={onOpenFeedback}
        >
          Feedback
        </button>
        {isAdmin && (
          <button
            className="projects-rail-utility-item"
            onClick={onOpenAdmin}
          >
            Admin
          </button>
        )}
        <button
          className="projects-rail-utility-item"
          onClick={onOpenSettings}
        >
          Settings
        </button>
      </div>
    </>
  );
}
