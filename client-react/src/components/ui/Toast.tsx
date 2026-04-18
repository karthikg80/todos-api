import type { ReactNode } from "react";

export type ToastVariant = "info" | "success" | "warning" | "danger" | "ai";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastProps {
  variant: ToastVariant;
  title: ReactNode;
  description?: ReactNode;
  action?: ToastAction;
  onDismiss?: () => void;
}

const ICON_BY_VARIANT: Record<ToastVariant, ReactNode> = {
  info: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7v4M8 4.5v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  success: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2l6.5 11.5h-13L8 2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6v3.5M8 11.5v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  danger: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 5.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  ai: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2l1.8 4.2L14 8l-4.2 1.8L8 14l-1.8-4.2L2 8l4.2-1.8L8 2z" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  ),
};

export function Toast({
  variant,
  title,
  description,
  action,
  onDismiss,
}: ToastProps) {
  return (
    <div
      className="toast"
      data-variant={variant}
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      aria-live={variant === "danger" || variant === "warning" ? "assertive" : "polite"}
    >
      <span className="toast-icon">{ICON_BY_VARIANT[variant]}</span>
      <div className="toast-body">
        <b>{title}</b>
        {description && <span>{description}</span>}
      </div>
      {action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            action.onClick();
            onDismiss?.();
          }}
        >
          {action.label}
        </button>
      )}
      {onDismiss && !action && (
        <button
          type="button"
          className="toast-action"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}
