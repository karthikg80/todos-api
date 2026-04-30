// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement as ce } from "react";
import { HeadingComposer } from "./HeadingComposer";

const baseProps = {
  open: false,
  value: "",
  onChange: vi.fn(),
  onAdd: vi.fn(),
  onOpen: vi.fn(),
  onClose: vi.fn(),
};

describe("HeadingComposer", () => {
  it("shows the New heading trigger when closed", () => {
    render(ce(HeadingComposer, baseProps));
    expect(screen.getByRole("button", { name: /new heading/i })).toBeTruthy();
  });

  it("calls onOpen when trigger is clicked", () => {
    const onOpen = vi.fn();
    render(ce(HeadingComposer, { ...baseProps, onOpen }));
    fireEvent.click(screen.getByRole("button", { name: /new heading/i }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("shows the input when open", () => {
    render(ce(HeadingComposer, { ...baseProps, open: true }));
    expect(
      screen.getByPlaceholderText("Type a heading and press Enter"),
    ).toBeTruthy();
  });

  it("calls onChange when the input changes", () => {
    const onChange = vi.fn();
    render(
      ce(HeadingComposer, { ...baseProps, open: true, value: "", onChange }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("Type a heading and press Enter"),
      { target: { value: "Q2 Goals" } },
    );
    expect(onChange).toHaveBeenCalledWith("Q2 Goals");
  });

  it("calls onAdd when Enter is pressed", () => {
    const onAdd = vi.fn();
    render(
      ce(HeadingComposer, {
        ...baseProps,
        open: true,
        value: "Q2 Goals",
        onAdd,
      }),
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText("Type a heading and press Enter"),
      { key: "Enter" },
    );
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("calls onClose and onChange('') when Escape is pressed", () => {
    const onClose = vi.fn();
    const onChange = vi.fn();
    render(
      ce(HeadingComposer, {
        ...baseProps,
        open: true,
        value: "Q2 Goals",
        onClose,
        onChange,
      }),
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText("Type a heading and press Enter"),
      { key: "Escape" },
    );
    expect(onChange).toHaveBeenCalledWith("");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on blur when value is empty", () => {
    const onClose = vi.fn();
    render(
      ce(HeadingComposer, { ...baseProps, open: true, value: "", onClose }),
    );
    fireEvent.blur(
      screen.getByPlaceholderText("Type a heading and press Enter"),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose on blur when value is non-empty", () => {
    const onClose = vi.fn();
    render(
      ce(HeadingComposer, {
        ...baseProps,
        open: true,
        value: "Q2 Goals",
        onClose,
      }),
    );
    fireEvent.blur(
      screen.getByPlaceholderText("Type a heading and press Enter"),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
