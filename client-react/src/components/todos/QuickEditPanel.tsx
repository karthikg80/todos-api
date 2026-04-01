import { useEffect, useRef } from "react";
import type { Todo, UpdateTodoDto, Project, Heading } from "../../types";
import { FieldRenderer } from "./FieldRenderer";
import { useFieldLayout } from "../../hooks/useFieldLayout";
import { FIELD_REGISTRY_BY_KEY } from "../../types/fieldLayout";

interface Props {
  todo: Todo;
  projects: Project[];
  headings: Heading[];
  onSave: (id: string, dto: UpdateTodoDto) => Promise<unknown>;
  onOpenDrawer: () => void;
}

/**
 * Inline expandable panel rendered below a TodoRow.
 * Shows the top tier-1 fields for quick edits.
 * Focus moves to the first editable field on mount.
 */
export function QuickEditPanel({
  todo,
  projects,
  headings,
  onSave,
  onOpenDrawer,
}: Props) {
  const layout = useFieldLayout();
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus first editable field on mount
  useEffect(() => {
    const firstInput = panelRef.current?.querySelector<HTMLElement>(
      "select, input, textarea",
    );
    if (firstInput) {
      requestAnimationFrame(() => firstInput.focus());
    }
  }, []);

  const save = (field: string, value: unknown) => {
    onSave(todo.id, { [field]: value ?? null } as UpdateTodoDto);
  };

  const fieldKeys = layout.quickEdit;

  return (
    <div
      className="quick-edit-panel"
      ref={panelRef}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="quick-edit-panel__fields">
        {fieldKeys.map((key) => {
          const def = FIELD_REGISTRY_BY_KEY[key];
          if (!def) return null;
          return (
            <FieldRenderer
              key={key}
              fieldDef={def}
              todo={todo}
              projects={projects}
              headings={headings}
              onSave={save}
              compact
            />
          );
        })}
      </div>
      <div className="quick-edit-panel__actions">
        <button
          className="btn btn--sm btn--outline"
          onClick={onOpenDrawer}
        >
          Open details
        </button>
      </div>
    </div>
  );
}
