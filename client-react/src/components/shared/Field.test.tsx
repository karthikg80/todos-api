// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field } from "./Field";

describe("Field", () => {
  it("renders the label and child input", () => {
    render(
      ce(
        Field,
        { label: "Email", htmlFor: "email" },
        ce("input", { id: "email", type: "email" }),
      ),
    );
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });

  it("renders help text below the input when provided", () => {
    render(
      ce(
        Field,
        {
          label: "Daily limit",
          htmlFor: "limit",
          help: "Tasks scheduled per day",
        },
        ce("input", { id: "limit" }),
      ),
    );
    expect(screen.getByText("Tasks scheduled per day")).toBeTruthy();
  });

  it("renders error text and applies the error modifier when error is set", () => {
    const { container } = render(
      ce(
        Field,
        {
          label: "Title",
          htmlFor: "title",
          error: "Title is required",
        },
        ce("input", { id: "title" }),
      ),
    );
    expect(screen.getByText("Title is required")).toBeTruthy();
    expect(container.querySelector(".field.field--error")).toBeTruthy();
  });

  it("uses the row layout when layout='row'", () => {
    const { container } = render(
      ce(
        Field,
        { label: "Tune-up", htmlFor: "x", layout: "row" },
        ce("button", { id: "x" }, "Open"),
      ),
    );
    expect(container.querySelector(".field.field--row")).toBeTruthy();
  });

  it("does not duplicate the help slot when neither help nor error are provided", () => {
    const { container } = render(
      ce(
        Field,
        { label: "Name", htmlFor: "name" },
        ce("input", { id: "name" }),
      ),
    );
    expect(container.querySelector(".field__help")).toBeNull();
    expect(container.querySelector(".field__error")).toBeNull();
  });
});
