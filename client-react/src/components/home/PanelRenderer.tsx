// client-react/src/components/home/PanelRenderer.tsx
import { FocusPanel } from "./FocusPanel";
import type { RankedPanel } from "../../types/focusBrief";

interface Props {
  panel: RankedPanel;
  onTaskClick: (id: string) => void;
  onSelectProject: (id: string) => void;
}

function UnsortedPanel({ data, onTaskClick }: { data: any; onTaskClick: (id: string) => void }) {
  return (
    <FocusPanel title="Unsorted Items" color="warning" subtitle={`${data.items.length} items`}>
      <div className="focus-list">
        {data.items.map((item: any) => (
          <button key={item.id} className="focus-list__item" onClick={() => onTaskClick(item.id)}>
            {item.title}
          </button>
        ))}
      </div>
    </FocusPanel>
  );
}

function DueSoonPanel({ data, onTaskClick }: { data: any; onTaskClick: (id: string) => void }) {
  const totalItems = data.groups.reduce((s: number, g: any) => s + g.items.length, 0);
  return (
    <FocusPanel title="Due Soon" color="danger" subtitle={`${totalItems} tasks`}>
      {data.groups.map((group: any) => (
        <div key={group.label} className="focus-group">
          <div className="focus-group__label">{group.label}</div>
          {group.items.map((item: any) => (
            <button key={item.id} className="focus-list__item" onClick={() => onTaskClick(item.id)}>
              <span>{item.title}</span>
              {item.dueDate && <span className={`focus-list__badge${item.overdue ? " focus-list__badge--overdue" : ""}`}>{item.dueDate}</span>}
            </button>
          ))}
        </div>
      ))}
    </FocusPanel>
  );
}

function WhatNextPanel({ data, onTaskClick }: { data: any; onTaskClick: (id: string) => void }) {
  return (
    <FocusPanel title="What Next" color="accent" subtitle={`${data.items.length} recommendations`}>
      <div className="focus-list">
        {data.items.map((item: any) => (
          <button key={item.id} className="focus-list__item focus-list__item--rich" onClick={() => onTaskClick(item.id)}>
            <div className="focus-list__item-title">{item.title}</div>
            <div className="focus-list__item-meta">{item.reason}</div>
            <div className="focus-list__item-badges">
              <span className={`focus-badge focus-badge--${item.impact}`}>{item.impact}</span>
              <span className="focus-badge">{item.effort}</span>
            </div>
          </button>
        ))}
      </div>
    </FocusPanel>
  );
}

function BacklogHygienePanel({ data, onTaskClick }: { data: any; onTaskClick: (id: string) => void }) {
  return (
    <FocusPanel title="Backlog Hygiene" color="warning" subtitle={`${data.items.length} stale`}>
      <div className="focus-list">
        {data.items.map((item: any) => (
          <button key={item.id} className="focus-list__item" onClick={() => onTaskClick(item.id)}>
            <span>{item.title}</span>
            <span className="focus-list__meta">{item.staleDays}d untouched</span>
          </button>
        ))}
      </div>
    </FocusPanel>
  );
}

function ProjectsToNudgePanel({ data, onSelectProject }: { data: any; onSelectProject: (id: string) => void }) {
  return (
    <FocusPanel title="Projects to Nudge" color="purple">
      <div className="focus-list">
        {data.items.map((item: any) => (
          <button key={item.id} className="focus-list__item" onClick={() => onSelectProject(item.id)}>
            <span>{item.name}</span>
            <span className="focus-list__meta">
              {[
                item.overdueCount > 0 && `${item.overdueCount} overdue`,
                item.waitingCount > 0 && `${item.waitingCount} waiting`,
                item.dueSoonCount > 0 && `${item.dueSoonCount} due soon`,
              ].filter(Boolean).join(" · ")}
            </span>
          </button>
        ))}
      </div>
    </FocusPanel>
  );
}

function TrackOverviewPanel({ data }: { data: any }) {
  return (
    <FocusPanel title="Task Timeline" color="accent">
      <div className="focus-track">
        {(["thisWeek", "next14Days", "later"] as const).map((col) => (
          <div key={col} className="focus-track__column">
            <div className={`focus-track__header focus-track__header--${col}`}>
              {col === "thisWeek" ? "This week" : col === "next14Days" ? "Next 14 days" : "Later"}
            </div>
            {data.columns[col].map((item: any) => (
              <div key={item.id} className="focus-track__item">{item.title}</div>
            ))}
          </div>
        ))}
      </div>
    </FocusPanel>
  );
}

function RescueModePanel({ data }: { data: any }) {
  if (data.openCount <= 10 || data.overdueCount <= 3) return null;
  return (
    <FocusPanel title="Rescue Mode" color="danger">
      <p className="focus-rescue__text">
        You have <strong>{data.openCount}</strong> open tasks and <strong>{data.overdueCount}</strong> are overdue.
        Consider triaging or deferring some tasks.
      </p>
    </FocusPanel>
  );
}

const PANEL_MAP: Record<string, React.ComponentType<any>> = {
  unsorted: UnsortedPanel,
  dueSoon: DueSoonPanel,
  whatNext: WhatNextPanel,
  backlogHygiene: BacklogHygienePanel,
  projectsToNudge: ProjectsToNudgePanel,
  trackOverview: TrackOverviewPanel,
  rescueMode: RescueModePanel,
};

export function PanelRenderer({ panel, onTaskClick, onSelectProject }: Props) {
  const Component = PANEL_MAP[panel.type];
  if (!Component) return null;
  return <Component data={panel.data} onTaskClick={onTaskClick} onSelectProject={onSelectProject} />;
}
