// client-react/src/components/home/PanelRenderer.tsx
import { FlipCard } from "./FlipCard";
import { CardBack } from "./CardBack";
import { PANEL_ART } from "./pixel-art";
import type { RankedPanel, PanelProvenance } from "../../types/focusBrief";

interface Props {
  panel: RankedPanel;
  onTaskClick: (id: string) => void;
  onSelectProject: (id: string) => void;
  onEditTodo?: (id: string, updates: Record<string, unknown>) => void;
}

// ─── Unsorted Panel ────────────────────────────────────────────────────────

function UnsortedPanel({
  data,
  provenance,
  reason,
  onTaskClick,
  onEditTodo,
}: {
  data: any;
  provenance: PanelProvenance;
  reason: string;
  onTaskClick: (id: string) => void;
  onEditTodo?: (id: string, updates: Record<string, unknown>) => void;
}) {
  const Art = PANEL_ART["unsorted"];
  const topItem = data.items[0];

  const front = (
    <div className="panel-unsorted">
      <div className="panel-unsorted__header">
        <Art size={18} />
        <span className="panel-unsorted__title">Unsorted Items</span>
        <span className="focus-panel__subtitle">{data.items.length} items</span>
      </div>
      <div className="inbox-stack">
        <div className="inbox-stack__shadow inbox-stack__shadow--far" />
        <div className="inbox-stack__shadow inbox-stack__shadow--near" />
        <div className="inbox-stack__front">
          {topItem ? (
            <>
              <button
                className="focus-list__item-title"
                onClick={() => onTaskClick(topItem.id)}
              >
                {topItem.title}
              </button>
              {onEditTodo && (
                <div className="focus-list__item-actions">
                  <button
                    className="focus-action-chip"
                    onClick={() => onEditTodo(topItem.id, { status: "next" })}
                    title="Move to Next"
                  >
                    Next
                  </button>
                  <button
                    className="focus-action-chip focus-action-chip--muted"
                    onClick={() =>
                      onEditTodo(topItem.id, { status: "someday" })
                    }
                    title="Move to Someday"
                  >
                    Later
                  </button>
                </div>
              )}
            </>
          ) : (
            <span className="focus-panel__empty">All clear!</span>
          )}
        </div>
      </div>
      {data.items.length > 1 && (
        <div className="focus-list">
          {data.items.slice(1).map((item: any) => (
            <div
              key={item.id}
              className="focus-list__item focus-list__item--triage"
            >
              <button
                className="focus-list__item-title"
                onClick={() => onTaskClick(item.id)}
              >
                {item.title}
              </button>
              {onEditTodo && (
                <div className="focus-list__item-actions">
                  <button
                    className="focus-action-chip"
                    onClick={() => onEditTodo(item.id, { status: "next" })}
                    title="Move to Next"
                  >
                    Next
                  </button>
                  <button
                    className="focus-action-chip focus-action-chip--muted"
                    onClick={() => onEditTodo(item.id, { status: "someday" })}
                    title="Move to Someday"
                  >
                    Later
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const back = (
    <CardBack
      provenance={provenance}
      reason={reason}
      pixelArt={<Art size={64} />}
    />
  );

  return <FlipCard front={front} back={back} />;
}

// ─── Due Soon Panel ────────────────────────────────────────────────────────

function DueSoonPanel({
  data,
  provenance,
  reason,
  onTaskClick,
}: {
  data: any;
  provenance: PanelProvenance;
  reason: string;
  onTaskClick: (id: string) => void;
}) {
  const Art = PANEL_ART["dueSoon"];
  const totalItems = data.groups.reduce(
    (s: number, g: any) => s + g.items.length,
    0,
  );
  const maxCount = Math.max(...data.groups.map((g: any) => g.items.length), 1);

  const front = (
    <div className="panel-due-soon">
      <div className="panel-due-soon__header">
        <Art size={18} />
        <span className="panel-due-soon__title">Due Soon</span>
        <span className="focus-panel__subtitle">{totalItems} tasks</span>
      </div>
      <div className="urgency-bars">
        {data.groups.map((group: any) => (
          <div key={group.label} className="urgency-bar">
            <div className="urgency-bar__label">
              <span>{group.label}</span>
              <span>{group.items.length}</span>
            </div>
            <div className="urgency-bar__track">
              <div
                className="urgency-bar__fill"
                style={{
                  width: `${Math.round((group.items.length / maxCount) * 100)}%`,
                  background: group.items.some((i: any) => i.overdue)
                    ? "var(--danger)"
                    : "var(--warning)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="focus-list" style={{ marginTop: "var(--s-2)" }}>
        {data.groups
          .flatMap((g: any) => g.items)
          .slice(0, 3)
          .map((item: any) => (
            <button
              key={item.id}
              className="focus-list__item"
              onClick={() => onTaskClick(item.id)}
            >
              <span>{item.title}</span>
              {item.dueDate && (
                <span
                  className={`focus-list__badge${item.overdue ? " focus-list__badge--overdue" : ""}`}
                >
                  {item.dueDate}
                </span>
              )}
            </button>
          ))}
      </div>
    </div>
  );

  const back = (
    <CardBack
      provenance={provenance}
      reason={reason}
      pixelArt={<Art size={64} />}
    />
  );

  return <FlipCard front={front} back={back} />;
}

// ─── What Next Panel ───────────────────────────────────────────────────────

function WhatNextPanel({
  data,
  provenance,
  reason,
  onTaskClick,
}: {
  data: any;
  provenance: PanelProvenance;
  reason: string;
  onTaskClick: (id: string) => void;
}) {
  const Art = PANEL_ART["whatNext"];

  const front = (
    <div className="panel-what-next">
      <div className="panel-what-next__header">
        <Art size={18} />
        <span className="panel-what-next__title">What Next</span>
        <span className="focus-panel__subtitle">
          {data.items.length} recommendations
        </span>
      </div>
      <div className="focus-list">
        {data.items.map((item: any) => (
          <div
            key={item.id}
            className="impact-card"
            onClick={() => onTaskClick(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onTaskClick(item.id)}
          >
            <div className="impact-card__top">
              <span className="focus-list__item-title">{item.title}</span>
              <div style={{ display: "flex", gap: "var(--s-1)" }}>
                <span className={`focus-badge focus-badge--${item.impact}`}>
                  {item.impact}
                </span>
                <span className="focus-badge">{item.effort}</span>
              </div>
            </div>
            <div className="impact-card__reason">{item.reason}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const back = (
    <CardBack
      provenance={provenance}
      reason={reason}
      pixelArt={<Art size={64} />}
    />
  );

  return <FlipCard front={front} back={back} />;
}

// ─── Backlog Hygiene Panel ─────────────────────────────────────────────────

function BacklogHygienePanel({
  data,
  provenance,
  reason,
  onTaskClick,
}: {
  data: any;
  provenance: PanelProvenance;
  reason: string;
  onTaskClick: (id: string) => void;
}) {
  const Art = PANEL_ART["backlogHygiene"];

  const front = (
    <div className="panel-backlog">
      <div className="panel-backlog__header">
        <Art size={18} />
        <span className="panel-backlog__title">Backlog Hygiene</span>
        <span className="focus-panel__subtitle">{data.items.length} stale</span>
      </div>
      <div className="focus-list">
        {data.items.map((item: any) => (
          <button
            key={item.id}
            className="focus-list__item decay-item"
            onClick={() => onTaskClick(item.id)}
          >
            <div className="decay-item__row">
              <span>{item.title}</span>
              <span className="focus-list__meta">
                {item.staleDays}d untouched
              </span>
            </div>
            <div className="decay-item__bar">
              <div
                className="decay-item__fill"
                style={{
                  width: `${Math.min(Math.round((item.staleDays / 30) * 100), 100)}%`,
                }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const back = (
    <CardBack
      provenance={provenance}
      reason={reason}
      pixelArt={<Art size={64} />}
    />
  );

  return <FlipCard front={front} back={back} />;
}

// ─── Projects To Nudge Panel ───────────────────────────────────────────────

function ProjectsToNudgePanel({
  data,
  provenance,
  reason,
  onSelectProject,
}: {
  data: any;
  provenance: PanelProvenance;
  reason: string;
  onSelectProject: (id: string) => void;
}) {
  const Art = PANEL_ART["projectsToNudge"];

  const front = (
    <div className="panel-nudge">
      <div className="panel-nudge__header">
        <Art size={18} />
        <span className="panel-nudge__title">Projects to Nudge</span>
      </div>
      <div className="focus-list">
        {data.items.map((item: any) => {
          const isCritical = item.overdueCount > 0;
          return (
            <button
              key={item.id}
              className="focus-list__item health-item"
              onClick={() => onSelectProject(item.id)}
            >
              <div
                className={`health-dot health-dot--${isCritical ? "critical" : "warning"}`}
              >
                {isCritical ? "!" : "~"}
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div>{item.name}</div>
                <div className="focus-list__meta">
                  {[
                    item.overdueCount > 0 && `${item.overdueCount} overdue`,
                    item.waitingCount > 0 && `${item.waitingCount} waiting`,
                    item.dueSoonCount > 0 && `${item.dueSoonCount} due soon`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const back = (
    <CardBack
      provenance={provenance}
      reason={reason}
      pixelArt={<Art size={64} />}
    />
  );

  return <FlipCard front={front} back={back} />;
}

// ─── Track Overview Panel ──────────────────────────────────────────────────

function TrackOverviewPanel({
  data,
  provenance,
  reason,
}: {
  data: any;
  provenance: PanelProvenance;
  reason: string;
}) {
  const Art = PANEL_ART["trackOverview"];

  const front = (
    <div className="panel-track">
      <div className="panel-track__header">
        <Art size={18} />
        <span className="panel-track__title">Task Timeline</span>
      </div>
      <div className="focus-track">
        {(["thisWeek", "next14Days", "later"] as const).map((col) => (
          <div key={col} className="focus-track__column">
            <div className={`focus-track__header focus-track__header--${col}`}>
              {col === "thisWeek"
                ? "This week"
                : col === "next14Days"
                  ? "Next 14 days"
                  : "Later"}
            </div>
            {data.columns[col].map((item: any) => (
              <div key={item.id} className="focus-track__item">
                {item.title}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  const back = (
    <CardBack
      provenance={provenance}
      reason={reason}
      pixelArt={<Art size={64} />}
    />
  );

  return <FlipCard front={front} back={back} />;
}

// ─── Rescue Mode Panel ─────────────────────────────────────────────────────

function RescueModePanel({
  data,
  provenance,
  reason,
}: {
  data: any;
  provenance: PanelProvenance;
  reason: string;
}) {
  if (data.openCount <= 10 || data.overdueCount <= 3) return null;

  const Art = PANEL_ART["rescueMode"];

  const front = (
    <div className="panel-rescue">
      <div className="panel-rescue__header">
        <Art size={18} />
        <span className="panel-rescue__title">Rescue Mode</span>
      </div>
      <p className="focus-rescue__text">
        You have <strong>{data.openCount}</strong> open tasks and{" "}
        <strong>{data.overdueCount}</strong> are overdue. Consider triaging or
        deferring some tasks.
      </p>
    </div>
  );

  const back = (
    <CardBack
      provenance={provenance}
      reason={reason}
      pixelArt={<Art size={64} />}
    />
  );

  return <FlipCard front={front} back={back} />;
}

// ─── Panel Map ─────────────────────────────────────────────────────────────

const PANEL_MAP: Record<string, React.ComponentType<any>> = {
  unsorted: UnsortedPanel,
  dueSoon: DueSoonPanel,
  whatNext: WhatNextPanel,
  backlogHygiene: BacklogHygienePanel,
  projectsToNudge: ProjectsToNudgePanel,
  trackOverview: TrackOverviewPanel,
  rescueMode: RescueModePanel,
};

// ─── PanelRenderer ─────────────────────────────────────────────────────────

export function PanelRenderer({
  panel,
  onTaskClick,
  onSelectProject,
  onEditTodo,
}: Props) {
  const Component = PANEL_MAP[panel.type];
  if (!Component) return null;
  return (
    <Component
      data={panel.data}
      provenance={panel.provenance}
      reason={panel.reason}
      onTaskClick={onTaskClick}
      onSelectProject={onSelectProject}
      onEditTodo={onEditTodo}
    />
  );
}
