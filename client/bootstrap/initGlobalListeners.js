// =============================================================================
// initGlobalListeners.js — Declarative DOM event delegation and service worker.
//
// Extracted from app.js to separate the event dispatch infrastructure from
// domain-specific wiring. The declarative handler system resolves `data-onclick`,
// `data-onsubmit`, etc. attributes by calling `window[functionName](args)`.
// =============================================================================

const FILTER_INPUT_DEBOUNCE_MS = 180;

const debounce = (fn, ms) => {
  let t;
  return (...args) => {
    const leading = !t;
    clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      if (!leading) fn(...args);
    }, ms);
    if (leading) fn(...args);
  };
};

const DEBOUNCED_INPUT_EXPRESSIONS = new Set([
  "filterTodos()",
  "syncSheetSearch()",
]);

function invokeBoundExpression(expression, event, element) {
  const source = expression.trim().replace(/;$/, "");
  if (!source) return;

  const eventMethodMatch = source.match(/^event\.([A-Za-z_$][\w$]*)\(\)$/);
  if (eventMethodMatch) {
    const methodName = eventMethodMatch[1];
    const method = event?.[methodName];
    if (typeof method === "function") {
      method.call(event);
    }
    return;
  }

  const callMatch = source.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);
  if (!callMatch) return;

  const functionName = callMatch[1];
  const rawArgs = callMatch[2].trim();
  const target = window[functionName];
  if (typeof target !== "function") return;

  const tokens =
    rawArgs === "" ? [] : rawArgs.match(/'[^']*'|\"[^\"]*\"|[^,]+/g) || [];
  const args = tokens.map((token) => {
    const arg = token.trim();
    if (arg === "event") return event;
    if (arg === "this") return element;
    if (arg === "this.value") {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) {
        return element.value;
      }
      return "";
    }
    if (arg === "this.checked") {
      if (element instanceof HTMLInputElement) {
        return element.checked;
      }
      return false;
    }
    if (/^'.*'$/.test(arg) || /^\".*\"$/.test(arg)) return arg.slice(1, -1);
    if (arg === "true") return true;
    if (arg === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(arg)) return Number(arg);
    return arg;
  });

  target(...args);
}

export function bindDeclarativeHandlers() {
  if (window.__declarativeHandlersBound) {
    return;
  }
  window.__declarativeHandlersBound = true;

  const inputDebouncedInvokers = new Map();

  const events = [
    "click",
    "submit",
    "input",
    "change",
    "keypress",
    "dragstart",
    "dragover",
    "drop",
    "dragend",
  ];

  for (const eventType of events) {
    const attribute = `on${eventType}`;
    document.addEventListener(eventType, (event) => {
      const rawTarget = event.target;
      const target =
        rawTarget instanceof Element
          ? rawTarget
          : rawTarget instanceof Node
            ? rawTarget.parentElement
            : null;
      let element = target?.closest(`[data-${attribute}]`) || null;
      if (!element && (eventType === "dragover" || eventType === "drop")) {
        const clientX = Number(event.clientX);
        const clientY = Number(event.clientY);
        if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
          const pointTarget = document.elementFromPoint(clientX, clientY);
          if (pointTarget instanceof Element) {
            element = pointTarget.closest(`[data-${attribute}]`);
          }
        }
      }
      if (!element && eventType === "drop") {
        const fallbackDropTarget = document.querySelector(
          ".todo-item--heading-drop-target, .todo-item.drag-over, .todo-heading-divider--drag-over-before, .todo-heading-divider--drag-over-after",
        );
        if (fallbackDropTarget instanceof Element) {
          element = fallbackDropTarget.closest(`[data-${attribute}]`);
        }
      }
      if (!element) return;
      const expression = element.dataset[attribute];
      if (!expression) return;
      if (
        eventType === "input" &&
        DEBOUNCED_INPUT_EXPRESSIONS.has(expression)
      ) {
        let fn = inputDebouncedInvokers.get(expression);
        if (!fn) {
          fn = debounce(
            (expr, ev, el) => invokeBoundExpression(expr, ev, el),
            FILTER_INPUT_DEBOUNCE_MS,
          );
          inputDebouncedInvokers.set(expression, fn);
        }
        fn(expression, event, element);
      } else {
        invokeBoundExpression(expression, event, element);
      }
    });
  }
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    const shouldRegister =
      window.location.protocol === "https:" &&
      window.location.hostname !== "localhost";

    if (!shouldRegister) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );
      return;
    }

    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log(
          "Service Worker registered successfully:",
          registration.scope,
        );
      })
      .catch((error) => {
        console.log("Service Worker registration failed:", error);
      });
  });
}
