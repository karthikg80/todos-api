import type { CSSProperties, HTMLAttributes } from "react";

export type SkeletonShape = "line" | "title" | "chip" | "circle";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  shape?: SkeletonShape;
  width?: number | string;
  height?: number | string;
}

export function Skeleton({
  shape = "line",
  width,
  height,
  className,
  style,
  ...rest
}: SkeletonProps) {
  const classes = ["skel", `skel--${shape}`];
  if (className) classes.push(className);

  const sized: CSSProperties = { ...style };
  if (width !== undefined) sized.width = width;
  if (height !== undefined) sized.height = height;

  return (
    <div
      className={classes.join(" ")}
      style={sized}
      aria-hidden="true"
      {...rest}
    />
  );
}
