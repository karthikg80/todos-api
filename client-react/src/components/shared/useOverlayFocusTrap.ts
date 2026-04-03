import { useEffect, useRef, type RefObject } from "react";

interface Options {
  isOpen: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onClose?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
}

function getFocusable(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) =>
    !element.hasAttribute("hidden") &&
    element.getAttribute("aria-hidden") !== "true" &&
    element.getClientRects().length > 0,
  );
}

export function useOverlayFocusTrap({
  isOpen,
  containerRef,
  onClose,
  initialFocusRef,
  restoreFocus = true,
}: Options) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const container = containerRef.current;
    if (!container) return;

    const focusTarget =
      initialFocusRef?.current ??
      getFocusable(container)[0] ??
      container;

    requestAnimationFrame(() => {
      focusTarget.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!containerRef.current) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose?.();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusable(containerRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (restoreFocus && previousFocusRef.current?.isConnected) {
        requestAnimationFrame(() => {
          previousFocusRef.current?.focus({ preventScroll: true });
        });
      }
    };
  }, [containerRef, initialFocusRef, isOpen, onClose, restoreFocus]);
}
