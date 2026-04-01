import { useState, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Todo, Project, Heading, UpdateTodoDto } from "../../types";
import type { LoadState } from "../../store/useTodosStore";
import { TodoRow } from "./TodoRow";
import { IconGrip } from "../shared/Icons";
import { IllustrationTasksEmpty } from "../shared/Illustrations";

interface SortableRowProps {
  todo: Todo;
  isActive: boolean;
  isExpanded: boolean;
  isBulkMode: boolean;
  isSelected: boolean;
  isEntering?: boolean;
  projects: Project[];
  headings: Heading[];
  onToggle: (id: string, completed: boolean) => void;
  onClick: (id: string) => void;
  onKebab: (id: string) => void;
  onSelect: (id: string) => void;
  onInlineEdit: (id: string, title: string) => void;
  onSave: (id: string, dto: UpdateTodoDto) => Promise<unknown>;
  onTagClick?: (tag: string) => void;
  onLifecycleAction?: (id: string, action: string) => void;
}

function SortableRow(props: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.todo.id, disabled: props.isExpanded });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-row" {...attributes}>
      <button
        className="drag-handle"
        aria-label="Drag to reorder"
        {...listeners}
      >
        <IconGrip />
      </button>
      <TodoRow {...props} isEntering={props.isEntering} />
    </div>
  );
}

interface Props {
  todos: Todo[];
  loadState: LoadState;
  errorMessage: string;
  activeTodoId: string | null;
  expandedTodoId: string | null;
  isBulkMode: boolean;
  selectedIds: Set<string>;
  projects: Project[];
  headings: Heading[];
  onToggle: (id: string, completed: boolean) => void;
  onClick: (id: string) => void;
  onKebab: (id: string) => void;
  onRetry: () => void;
  onSelect: (id: string) => void;
  onInlineEdit: (id: string, title: string) => void;
  onSave: (id: string, dto: UpdateTodoDto) => Promise<unknown>;
  onTagClick?: (tag: string) => void;
  onLifecycleAction?: (id: string, action: string) => void;
  onReorder: (activeId: string, overId: string) => void;
}

export function SortableTodoList({
  todos,
  loadState,
  errorMessage,
  activeTodoId,
  expandedTodoId,
  isBulkMode,
  selectedIds,
  projects,
  headings,
  onToggle,
  onClick,
  onKebab,
  onRetry,
  onSelect,
  onInlineEdit,
  onSave,
  onTagClick,
  onLifecycleAction,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const prevIdsRef = useRef<Set<string>>(new Set());
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(todos.map((t) => t.id));
    const newIds = new Set<string>();
    for (const id of currentIds) {
      if (!prevIdsRef.current.has(id) && prevIdsRef.current.size > 0) {
        newIds.add(id);
      }
    }
    prevIdsRef.current = currentIds;
    if (newIds.size > 0) {
      setEnteringIds(newIds);
      const timer = setTimeout(() => setEnteringIds(new Set()), 350);
      return () => clearTimeout(timer);
    }
  }, [todos]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  if (loadState === "loading") {
    return (
      <div className="loading-skeleton loading">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="loading-skeleton__row" />
        ))}
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div id="todosErrorState" className="error-state">
        <p>{errorMessage || "Something went wrong"}</p>
        <button
          id="todosRetryLoadButton"
          className="error-state__btn"
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    );
  }

  if (loadState === "loaded" && todos.length === 0) {
    return (
      <div id="todosEmptyState" className="empty-state">
        <IllustrationTasksEmpty />
        <p>No tasks yet. Add one above!</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={todos.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div id="todosList">
          {todos.map((todo) => (
            <SortableRow
              key={todo.id}
              todo={todo}
              isActive={todo.id === activeTodoId}
              isExpanded={todo.id === expandedTodoId}
              isBulkMode={isBulkMode}
              isSelected={selectedIds.has(todo.id)}
              isEntering={enteringIds.has(todo.id)}
              projects={projects}
              headings={headings}
              onToggle={onToggle}
              onClick={onClick}
              onKebab={onKebab}
              onSelect={onSelect}
              onInlineEdit={onInlineEdit}
              onSave={onSave}
              onTagClick={onTagClick}
              onLifecycleAction={onLifecycleAction}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
