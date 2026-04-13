// @vitest-environment jsdom
// @ts-nocheck — complex mocked props cause createElement overload issues
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@example.com", name: "Test User" } }),
}));

vi.mock("../api/feedbackApi", () => ({
  submitFeedback: vi.fn().mockResolvedValue({ id: "fb-1", type: "bug", title: "Test" }),
}));

vi.mock("../utils/pageTransitions", () => ({
  navigateWithFade: vi.fn(),
}));

import { submitFeedback } from "../api/feedbackApi";
import { FeedbackForm } from "./FeedbackForm";

const { createElement: ce } = React;

describe("FeedbackForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    onSuccess: vi.fn(),
  };

  it("renders type selector with three options", () => {
    render(ce(FeedbackForm, defaultProps));
    const select = screen.getByLabelText("Submission type");
    expect(select).toBeTruthy();
    expect(screen.getByText("Bug report")).toBeTruthy();
    expect(screen.getByText("Feature request")).toBeTruthy();
    expect(screen.getByText("General feedback")).toBeTruthy();
  });

  it("renders title input", () => {
    render(ce(FeedbackForm, defaultProps));
    expect(screen.getByLabelText("Title")).toBeTruthy();
  });

  it("renders question fields based on type", () => {
    render(ce(FeedbackForm, defaultProps));
    // Default type is "bug"
    expect(screen.getByText("What happened?")).toBeTruthy();
    expect(screen.getByText("What did you expect?")).toBeTruthy();
    expect(screen.getByText("What were you doing right before it happened?")).toBeTruthy();
  });

  it("changes questions when type changes", () => {
    render(ce(FeedbackForm, defaultProps));
    fireEvent.change(screen.getByLabelText("Submission type"), { target: { value: "feature" } });
    expect(screen.getByText("What are you trying to do?")).toBeTruthy();
    expect(screen.getByText("What is hard today?")).toBeTruthy();
    expect(screen.getByText("What would make this better?")).toBeTruthy();
  });

  it("renders screenshot URL input", () => {
    render(ce(FeedbackForm, defaultProps));
    expect(screen.getByLabelText("Screenshot URL (optional)")).toBeTruthy();
  });

  it("shows error when submitting without title", () => {
    render(ce(FeedbackForm, defaultProps));
    const form = document.querySelector(".feedback-form");
    fireEvent.submit(form!);
    expect(screen.getByText("Please add a short title.")).toBeTruthy();
  });

  it("shows error when submitting without first answer", () => {
    render(ce(FeedbackForm, defaultProps));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Test title" } });
    const form = document.querySelector(".feedback-form");
    fireEvent.submit(form!);
    expect(screen.getByText("Please answer the first question before sending.")).toBeTruthy();
  });

  it("submits feedback when form is valid", async () => {
    render(ce(FeedbackForm, defaultProps));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Test title" } });
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Test answer" } });
    const submitBtn = screen.getByRole("button", { name: "Send feedback" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "bug",
        title: "Test title",
        body: expect.stringContaining("Test answer"),
      }),
    );
  });

  it("calls onSuccess after submission", async () => {
    render(ce(FeedbackForm, defaultProps));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Test title" } });
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Test answer" } });
    const submitBtn = screen.getByRole("button", { name: "Send feedback" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(defaultProps.onSuccess).toHaveBeenCalled();
  });

  it("shows error on submission failure", async () => {
    vi.mocked(submitFeedback).mockRejectedValueOnce(new Error("Network error"));
    render(ce(FeedbackForm, defaultProps));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Test title" } });
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Test answer" } });
    const submitBtn = screen.getByRole("button", { name: "Send feedback" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(screen.getByText("Network error")).toBeTruthy();
  });

  it("shows submitting state during submission", async () => {
    vi.mocked(submitFeedback).mockImplementationOnce(() => new Promise(() => {}));
    render(ce(FeedbackForm, defaultProps));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Test title" } });
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Test answer" } });
    const submitBtn = screen.getByRole("button", { name: "Send feedback" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(screen.getByRole("button", { name: "Sending…" })).toBeTruthy();
  });

  it("resets form fields when reset button is clicked", () => {
    render(ce(FeedbackForm, defaultProps));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Test title" } });
    fireEvent.change(screen.getByLabelText("Submission type"), { target: { value: "feature" } });

    fireEvent.click(screen.getByRole("button", { name: "Send another" }));

    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Submission type")).toHaveValue("bug");
  });

  it("includes pageUrl and userAgent in submission", async () => {
    render(ce(FeedbackForm, defaultProps));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Test title" } });
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Test answer" } });
    const submitBtn = screen.getByRole("button", { name: "Send feedback" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        pageUrl: expect.any(String),
        userAgent: expect.any(String),
      }),
    );
  });

  it("includes screenshotUrl when provided", async () => {
    render(ce(FeedbackForm, defaultProps));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Test title" } });
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Test answer" } });
    fireEvent.change(screen.getByLabelText("Screenshot URL (optional)"), { target: { value: "https://example.com/img.png" } });
    const submitBtn = screen.getByRole("button", { name: "Send feedback" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        screenshotUrl: "https://example.com/img.png",
      }),
    );
  });
});
