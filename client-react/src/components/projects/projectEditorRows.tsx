import { useEffect, useRef, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconGrip, IconKebab } from "../shared/Icons";

export function SortableRow({
  id,
  className,
  isDropTarget = false,
  children,
}: {
  id: string;
  className: string;
  isDropTarget?: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`${className}${isDragging ? " project-page__sortable-row--dragging" : ""}${
        isDropTarget ? " project-page__sortable-row--drop-target" : ""
      }`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        zIndex: isDragging ? 2 : undefined,
      }}
    >
      <button
        type="button"
        className="project-page__drag-handle"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <IconGrip size={14} />
      </button>
      {children}
    </div>
  );
}

export function RowMenu({
  label,
  open,
  onToggle,
  onClose,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return (
    <div className="project-page__menu" ref={panelRef}>
      <button
        type="button"
        ref={triggerRef}
        className="project-page__icon-btn"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onToggle}
      >
        <IconKebab size={14} />
      </button>
      {open ? <div className="project-page__menu-panel">{children}</div> : null}
    </div>
  );
}
