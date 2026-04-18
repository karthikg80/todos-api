// @vitest-environment jsdom
import { createRef } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("defaults to primary variant", () => {
    const { getByRole } = render(<Button>Go</Button>);
    expect(getByRole("button", { name: "Go" })).toHaveClass("btn", "btn--primary");
  });

  it.each(["primary", "secondary", "ghost", "danger", "ai"] as const)(
    "applies the %s variant class",
    (variant) => {
      const { getByRole } = render(<Button variant={variant}>X</Button>);
      expect(getByRole("button")).toHaveClass(`btn--${variant}`);
    },
  );

  it("adds the pill modifier when requested", () => {
    const { getByRole } = render(<Button pill>Pill</Button>);
    expect(getByRole("button")).toHaveClass("btn--pill");
  });

  it("merges caller-provided className with the generated classes", () => {
    const { getByRole } = render(<Button className="extra">Go</Button>);
    expect(getByRole("button")).toHaveClass("btn", "btn--primary", "extra");
  });

  it("forwards refs and click handlers", () => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button ref={ref} onClick={onClick}>
        Go
      </Button>,
    );
    expect(ref.current).toBe(getByRole("button"));
    fireEvent.click(getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    fireEvent.click(getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("defaults the HTML type to button so it does not submit forms implicitly", () => {
    const { getByRole } = render(<Button>Go</Button>);
    expect(getByRole("button")).toHaveAttribute("type", "button");
  });
});
