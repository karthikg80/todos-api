import type { Project } from "../../types";

export type DateView =
  | "all"
  | "today"
  | "upcoming"
  | "someday"
  | "waiting"
  | "completed";

const WORKSPACE_VIEWS: { key: DateView; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "someday", label: "Someday" },
  { key: "waiting", label: "Waiting" },
  { key: "completed", label: "Completed" },
];

interface Props {
  projects: Project[];
  activeView: DateView;
  selectedProjectId: string | null;
  onSelectView: (view: DateView) => void;
  onSelectProject: (id: string | null) => void;
}

export function Sidebar({
  projects,
  activeView,
  selectedProjectId,
  onSelectView,
  onSelectProject,
}: Props) {
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

      {projects.length > 0 && (
        <>
          <div className="projects-heading">Projects</div>
          <div id="projectsRailList">
            {projects
              .filter((p) => !p.archived)
              .map((p) => (
                <button
                  key={p.id}
                  className={`projects-rail-item${selectedProjectId === p.id ? " projects-rail-item--active" : ""}`}
                  data-project-key={p.name}
                  onClick={() => {
                    onSelectProject(p.id);
                  }}
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
        </>
      )}
    </>
  );
}
