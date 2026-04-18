// @vitest-environment jsdom
import { createRef } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("renders a label associated with the input by id", () => {
    const { getByLabelText } = render(<Input label="Email" />);
    expect(getByLabelText("Email").tagName).toBe("INPUT");
  });

  it("hides hint once an error is present and keeps the input marked invalid", () => {
    const { rerender, queryByText, getByRole } = render(
      <Input label="Email" hint="We never share it." />,
    );
    expect(queryByText("We never share it.")).toBeInTheDocument();
    expect(getByRole("textbox")).not.toHaveAttribute("aria-invalid");

    rerender(
      <Input
        label="Email"
        hint="We never share it."
        error="That email is taken."
      />,
    );
    expect(queryByText("We never share it.")).not.toBeInTheDocument();
    expect(queryByText("That email is taken.")).toBeInTheDocument();
    expect(getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("forwards onChange and ref", () => {
    const onChange = vi.fn();
    const ref = createRef<HTMLInputElement>();
    const { getByRole } = render(<Input ref={ref} onChange={onChange} />);
    fireEvent.change(getByRole("textbox"), { target: { value: "hi" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(getByRole("textbox"));
  });

  it("wires aria-describedby to the error and hint ids", () => {
    const { getByRole, rerender } = render(
      <Input label="Name" hint="Up to 40 characters." />,
    );
    const describedByHint = getByRole("textbox").getAttribute("aria-describedby");
    expect(describedByHint).toBeTruthy();
    expect(describedByHint).toMatch(/-hint$/);

    rerender(<Input label="Name" error="Required." />);
    const describedByError = getByRole("textbox").getAttribute("aria-describedby");
    expect(describedByError).toMatch(/-error$/);
  });
});
