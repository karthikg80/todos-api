import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Toast, type ToastAction, type ToastVariant } from "./Toast";

interface ToastRecord {
  id: number;
  variant: ToastVariant;
  title: ReactNode;
  description?: ReactNode;
  action?: ToastAction;
}

export interface ToastOptions {
  description?: ReactNode;
  action?: ToastAction;
  /** Override auto-dismiss. `null` keeps the toast persistent. */
  duration?: number | null;
}

type Publish = (
  variant: ToastVariant,
  title: ReactNode,
  options?: ToastOptions,
) => number;

export interface ToastApi {
  info: (title: ReactNode, options?: ToastOptions) => number;
  success: (title: ReactNode, options?: ToastOptions) => number;
  warning: (title: ReactNode, options?: ToastOptions) => number;
  danger: (title: ReactNode, options?: ToastOptions) => number;
  ai: (title: ReactNode, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const MAX_VISIBLE = 4;
const AUTO_DISMISS_MS: Record<ToastVariant, number | null> = {
  info: 5000,
  success: 5000,
  ai: 5000,
  warning: null,
  danger: null,
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const publish = useCallback<Publish>(
    (variant, title, options) => {
      const id = nextId.current++;
      const record: ToastRecord = {
        id,
        variant,
        title,
        description: options?.description,
        action: options?.action,
      };
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), record]);
      const duration =
        options?.duration === undefined
          ? AUTO_DISMISS_MS[variant]
          : options.duration;
      if (duration !== null && duration !== undefined && duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const snapshot = timers.current;
    return () => {
      snapshot.forEach((timer) => clearTimeout(timer));
      snapshot.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      info: (title, options) => publish("info", title, options),
      success: (title, options) => publish("success", title, options),
      warning: (title, options) => publish("warning", title, options),
      danger: (title, options) => publish("danger", title, options),
      ai: (title, options) => publish("ai", title, options),
      dismiss,
    }),
    [publish, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            title={t.title}
            description={t.description}
            action={t.action}
            onDismiss={() => dismiss(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
