import { useState } from "react";
import type { Project } from "../../types";
import { apiCall } from "../../api/client";

export type DateView =
  | "home"
  | "triage"
  | "all"
  | "today"
  | "upcoming"
  | "someday"
  | "waiting"
  | "completed"
  | "unsorted";

const WORKSPACE_VIEWS: { key: DateView; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "triage", label: "Triage" },
  { key: "all", label: "Everything" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "someday", label: "Someday" },
  { key: "waiting", label: "Waiting" },
  { key: "completed", label: "Completed" },
  { key: "unsorted", label: "Unsorted" },
];

interface Props {
  projects: Project[];
  activeView: DateView;
  selectedProjectId: string | null;
  onSelectView: (view: DateView) => void;
  onSelectProject: (id: string | null) => void;
  onCreateProject: () => void;
  onRenameProject: (id: string, name: string) => void;
  onOpenSettings: () => void;
  onRefreshProjects: () => void;
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
  onRefreshProjects,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const [showArchived, setShowArchived] = useState(false);

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

  return (
    <>
      <nav id="projectsRail" className="workspace-nav">
        {WORKSPACE_VIEWS.map((v) => (
          <button
            key={v.key}
            className={`workspace-view-item${activeView === v.key && !selectedProjectId ? " active" : ""}`}
            data-workspace-view={v.key}
            onClick={() => {
              onSelectProject(null);
              onSelectView(v.key);
            }}
          >
            {v.label}
          </button>
        ))}
      </nav>

      <div className="projects-heading">
        <span>Projects</span>
        <button
          id="railNewProjectBtn"
          className="projects-heading__add"
          onClick={onCreateProject}
          aria-label="New project"
        >
          +
        </button>
      </div>
      <div id="projectsRailList">
        {projects
          .filter((p) => !p.archived)
          .map((p) => (
            <button
              key={p.id}
              className={`projects-rail-item${selectedProjectId === p.id ? " projects-rail-item--active" : ""}`}
              data-project-key={p.name}
              onClick={() => onSelectProject(p.id)}
              onContextMenu={(e) => handleContextMenu(e, p.id)}
            >
              {p.name}
              {p.openTodoCount != null && (
                <span className="projects-rail-item__count">
                  {p.openTodoCount}
                </span>
              )}
            </button>
          ))}
      </div>

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

      <div className="sidebar-footer">
        <button className="workspace-view-item" onClick={onOpenSettings}>
          ⚙ Settings
        </button>
      </div>
    </>
  );
}
