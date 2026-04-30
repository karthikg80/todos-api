import type { ReactNode } from "react";

export type FieldLayout = "stacked" | "row";

export interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  help?: ReactNode;
  error?: ReactNode;
  layout?: FieldLayout;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  help,
  error,
  layout = "stacked",
  className,
  children,
}: FieldProps) {
  const classes = ["field"];
  if (layout === "row") classes.push("field--row");
  if (error) classes.push("field--error");
  if (className) classes.push(className);
  return (
    <div className={classes.join(" ")}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="field__control">{children}</div>
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="field__help">{help}</p>
      ) : null}
    </div>
  );
}
