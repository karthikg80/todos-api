import { useState, useMemo } from "react";
import type { Project, User } from "../../types";
import { apiCall } from "../../api/client";
import {
  IconFocus,
  IconDesk,
  IconEverything,
  IconToday,
  IconUpcoming,
  IconCompleted,
  IconPlus,
  IconSidebar,
} from "../shared/Icons";
import { ProfileLauncher } from "../shared/ProfileLauncher";

// Internal keys match classic store.js currentWorkspaceView values
export type WorkspaceView =
  | "home"
  | "triage"
  | "all"
  | "today"
  | "upcoming"
  | "completed";

// Display labels match classic app-shell.fragment
const WORKSPACE_VIEWS: {
  key: WorkspaceView;
  label: string;
  icon: React.ComponentType;
}[] = [
  { key: "home", label: "Focus", icon: IconFocus },
  { key: "triage", label: "Desk", icon: IconDesk },
  { key: "all", label: "Everything", icon: IconEverything },
  { key: "today", label: "Today", icon: IconToday },
  { key: "upcoming", label: "Upcoming", icon: IconUpcoming },
  { key: "completed", label: "Completed", icon: IconCompleted },
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

const STATUS_COLORS: Record<string, string> = {
  active: "var(--success)",
  on_hold: "var(--warning)",
  completed: "var(--muted)",
  archived: "var(--muted)",
};

function ProjectRailItem({
  project: p,
  isActive,
  onClick,
  onContextMenu,
}: {
  project: Project;
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const total = p.todoCount ?? 0;
  const completed = p.completedTaskCount ?? 0;
  const progress = total > 0 ? completed / total : 0;
  const isOverdue =
    p.targetDate && new Date(p.targetDate) < new Date(new Date().toDateString());

  return (
    <button
      className={`projects-rail-item${isActive ? " projects-rail-item--active" : ""}`}
      data-project-key={p.name}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <span
        className="projects-rail-item__status-dot"
        style={{ background: STATUS_COLORS[p.status] || "var(--muted)" }}
        title={p.status.replace("_", " ")}
      />
      <div className="projects-rail-item__content">
        <div className="projects-rail-item__top-row">
          <span className="nav-label">{p.name}</span>
          {p.openTodoCount != null && (
            <span className="projects-rail-item__count">
              {p.openTodoCount}
            </span>
          )}
        </div>
        {total > 0 && (
          <div className="projects-rail-item__progress-bar">
            <div
              className="projects-rail-item__progress-fill"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}
      </div>
      {p.targetDate && (
        <span
          className={`projects-rail-item__deadline${isOverdue ? " projects-rail-item__deadline--overdue" : ""}`}
        >
          {new Date(p.targetDate).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      )}
    </button>
  );
}

interface Props {
  projects: Project[];
  activeView: WorkspaceView;
  selectedProjectId: string | null;
  onSelectView: (view: WorkspaceView) => void;
  onSelectProject: (id: string | null) => void;
  onCreateProject: () => void;
  onRenameProject: (id: string, name: string) => void;
  onOpenSettings: () => void;
  onOpenFeedback: () => void;
  onOpenAdmin: () => void;
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  user: User | null;
  dark: boolean;
  isAdmin: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
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
  onOpenFeedback,
  onOpenAdmin,
  onToggleTheme,
  onOpenShortcuts,
  onOpenProfile,
  onLogout,
  user,
  dark,
  isAdmin,
  isCollapsed,
  onToggleCollapse,
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
      const area = p.area || "";
      const list = groups.get(area) || [];
      list.push(p);
      groups.set(area, list);
    }

    const sorted: Array<{ area: string; label: string; projects: Project[] }> =
      [];

    for (const area of AREA_ORDER) {
      const list = groups.get(area);
      if (list?.length) {
        sorted.push({
          area,
          label: AREA_LABELS[area] || area,
          projects: list,
        });
        groups.delete(area);
      }
    }

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

  const visibleViews = isSimple
    ? WORKSPACE_VIEWS.filter((v) => v.key !== "home" && v.key !== "triage")
    : WORKSPACE_VIEWS;

  return (
    <>
      {/* Collapse toggle */}
      <button
        className="sidebar-toggle-btn"
        onClick={onToggleCollapse}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <IconSidebar />
      </button>

      {/* Scrollable content area */}
      <div className="sidebar-scroll">
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
            <v.icon />
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
            <IconPlus />
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
                    <ProjectRailItem
                      key={p.id}
                      project={p}
                      isActive={selectedProjectId === p.id}
                      onClick={() => onSelectProject(p.id)}
                      onContextMenu={(e) => handleContextMenu(e, p.id)}
                    />
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
                const project = projects.find(
                  (p) => p.id === contextMenu.id,
                );
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

      </div>{/* end sidebar-scroll */}

      {/* Profile launcher — pinned at bottom, never scrolls */}
      <ProfileLauncher
        user={user}
        dark={dark}
        isAdmin={isAdmin}
        onOpenProfile={onOpenProfile}
        onOpenSettings={onOpenSettings}
        onToggleTheme={onToggleTheme}
        onOpenShortcuts={onOpenShortcuts}
        onOpenFeedback={onOpenFeedback}
        onOpenAdmin={onOpenAdmin}
        onLogout={onLogout}
      />
    </>
  );
}
