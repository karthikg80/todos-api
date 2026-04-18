// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./ToastProvider";

function Harness() {
  const toast = useToast();
  return (
    <div>
      <button type="button" onClick={() => toast.success("Saved", { description: "All good" })}>
        success
      </button>
      <button type="button" onClick={() => toast.warning("Heads up")}>
        warning
      </button>
      <button
        type="button"
        onClick={() =>
          toast.info("With action", {
            action: { label: "Undo", onClick: () => toast.info("Undone") },
          })
        }
      >
        action
      </button>
    </div>
  );
}

describe("ToastProvider + useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a toast when the API is called", () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "success" }));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("auto-dismisses info/success toasts after 5s", () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "success" }));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("leaves warning/danger toasts until dismissed explicitly", () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "warning" }));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText("Heads up")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Heads up")).not.toBeInTheDocument();
  });

  it("runs the action callback and dismisses when clicked", () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "action" }));
    expect(screen.getByText("With action")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.queryByText("With action")).not.toBeInTheDocument();
    expect(screen.getByText("Undone")).toBeInTheDocument();
  });

  it("throws when useToast is called outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
