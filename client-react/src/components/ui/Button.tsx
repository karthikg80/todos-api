import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ForwardedRef,
} from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "ai";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  pill?: boolean;
}

const DEFAULT_VARIANT: ButtonVariant = "primary";

export const Button = forwardRef(function Button(
  { variant = DEFAULT_VARIANT, pill, className, type, ...rest }: ButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  const classes = ["btn", `btn--${variant}`];
  if (pill) classes.push("btn--pill");
  if (className) classes.push(className);

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes.join(" ")}
      {...rest}
    />
  );
});
