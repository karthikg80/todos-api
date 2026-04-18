import {
  forwardRef,
  useId,
  type ForwardedRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
}

export const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    id,
    className,
    "aria-describedby": describedByProp,
    ...rest
  }: InputProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy =
    [describedByProp, errorId, hintId].filter(Boolean).join(" ") || undefined;
  const inputClass = className ? `input ${className}` : "input";

  return (
    <div className="field">
      {label && <label htmlFor={inputId}>{label}</label>}
      <input
        ref={ref}
        id={inputId}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint && !error && (
        <span id={hintId} className="field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});
