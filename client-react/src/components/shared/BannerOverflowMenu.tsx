import { useEffect, useRef, useState } from "react";

export interface SuppressedBanner {
  id: string;
  label: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface BannerOverflowMenuProps {
  suppressed: SuppressedBanner[];
}

export function BannerOverflowMenu({ suppressed }: BannerOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (suppressed.length === 0) return null;

  return (
    <div className="banner-overflow" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        className="banner-overflow__trigger"
        aria-label={`${suppressed.length} suppressed banner${suppressed.length > 1 ? "s" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
      >
        +{suppressed.length}
      </button>
      {open && (
        <div className="banner-overflow__panel" role="menu">
          {suppressed.map((item) => (
            <div
              key={item.id}
              className="banner-overflow__item"
              role="menuitem"
            >
              <span className="banner-overflow__item-label">{item.label}</span>
              {item.actionLabel && item.onAction && (
                <button
                  type="button"
                  className="banner-overflow__item-action"
                  onClick={() => {
                    item.onAction?.();
                    setOpen(false);
                  }}
                >
                  {item.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
