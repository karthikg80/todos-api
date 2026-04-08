// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function BrokenComponent(): never {
  throw new Error("Test error");
}

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Working content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Working content")).toBeTruthy();
  });

  it("renders error UI when child throws", () => {
    const spy = vi.spyOn(console, "error");
    spy.mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("Test error")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();

    spy.mockRestore();
  });

  it("renders custom fallback when provided", () => {
    const spy = vi.spyOn(console, "error");
    spy.mockImplementation(() => {});

    render(
      <ErrorBoundary
        fallback={<div data-testid="custom-fallback">Custom error</div>}
      >
        <BrokenComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("custom-fallback")).toBeTruthy();
    expect(screen.getByText("Custom error")).toBeTruthy();

    spy.mockRestore();
  });

  it("resets state when Try again is clicked", () => {
    const spy = vi.spyOn(console, "error");
    spy.mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Something went wrong")).toBeTruthy();

    spy.mockRestore();
  });
});
