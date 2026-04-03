function isVisible(element: HTMLElement) {
  return !element.hasAttribute("hidden") &&
    element.getAttribute("aria-hidden") !== "true" &&
    element.getClientRects().length > 0;
}

function getFirstVisible<T extends HTMLElement>(selector: string) {
  const elements = Array.from(document.querySelectorAll<T>(selector));
  return elements.find((element) => isVisible(element)) ?? null;
}

export function focusGlobalSearchInput() {
  const input = getFirstVisible<HTMLInputElement>('[data-global-search-input="true"]');
  if (!input) return false;
  input.focus();
  input.select?.();
  return true;
}

export function focusQuickEntryInput() {
  const input = getFirstVisible<HTMLInputElement>('[data-quick-entry-input="true"]');
  if (!input) return false;
  input.focus();
  return true;
}

export function triggerPrimaryNewTask() {
  if (focusQuickEntryInput()) {
    return true;
  }

  const trigger = getFirstVisible<HTMLElement>('[data-new-task-trigger="true"]');
  if (!trigger) return false;

  trigger.click();
  trigger.focus({ preventScroll: true });
  return true;
}
