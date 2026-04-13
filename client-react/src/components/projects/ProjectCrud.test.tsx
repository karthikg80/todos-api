// @vitest-environment jsdom
// @ts-nocheck — complex mocked props cause createElement overload issues
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("../../api/client", () => ({
  apiCall: vi.fn(),
}));

vi.mock("../shared/useOverlayFocusTrap", () => ({
  useOverlayFocusTrap: () => {},
}));

import { apiCall } from "../../api/client";
import { ProjectCrud } from "./ProjectCrud";

const { createElement: ce } = React;

describe("ProjectCrud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultCreateProps = {
    mode: "create" as const,
    onDone: vi.fn(),
    onCancel: vi.fn(),
  };

  const defaultRenameProps = {
    mode: "rename" as const,
    currentName: "Old Name",
    projectId: "p1",
    onDone: vi.fn(),
    onCancel: vi.fn(),
  };

  describe("create mode", () => {
    it("renders create dialog", () => {
      render(ce(ProjectCrud, defaultCreateProps));
      expect(screen.getByText("New Project")).toBeTruthy();
      expect(screen.getByPlaceholderText("Project name")).toBeTruthy();
    });

    it("disables submit when name is empty", () => {
      render(ce(ProjectCrud, defaultCreateProps));
      expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    });

    it("enables submit when name is entered", () => {
      render(ce(ProjectCrud, defaultCreateProps));
      fireEvent.change(screen.getByPlaceholderText("Project name"), { target: { value: "New Project" } });
      expect(screen.getByRole("button", { name: "Create" })).not.toBeDisabled();
    });

    it("creates project on submit", async () => {
      vi.mocked(apiCall).mockResolvedValue({ ok: true });
      render(ce(ProjectCrud, defaultCreateProps));
      fireEvent.change(screen.getByPlaceholderText("Project name"), { target: { value: "New Project" } });
      fireEvent.click(screen.getByRole("button", { name: "Create" }));

      await vi.waitFor(() => {
        expect(apiCall).toHaveBeenCalledWith(
          "/projects",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ name: "New Project" }),
          }),
        );
      });
    });

    it("calls onDone after successful creation", async () => {
      vi.mocked(apiCall).mockResolvedValue({ ok: true });
      const onDone = vi.fn();
      render(ce(ProjectCrud, { ...defaultCreateProps, onDone }));
      fireEvent.change(screen.getByPlaceholderText("Project name"), { target: { value: "New Project" } });
      fireEvent.click(screen.getByRole("button", { name: "Create" }));

      await vi.waitFor(() => {
        expect(onDone).toHaveBeenCalled();
      });
    });

    it("shows error on creation failure", async () => {
      vi.mocked(apiCall).mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Name taken" }),
      });
      render(ce(ProjectCrud, defaultCreateProps));
      fireEvent.change(screen.getByPlaceholderText("Project name"), { target: { value: "Existing" } });
      fireEvent.click(screen.getByRole("button", { name: "Create" }));

      await vi.waitFor(() => {
        expect(screen.getByText("Name taken")).toBeTruthy();
      });
    });

    it("shows generic error on network failure", async () => {
      vi.mocked(apiCall).mockRejectedValue(new Error("Network"));
      render(ce(ProjectCrud, defaultCreateProps));
      fireEvent.change(screen.getByPlaceholderText("Project name"), { target: { value: "Test" } });
      fireEvent.click(screen.getByRole("button", { name: "Create" }));

      await vi.waitFor(() => {
        expect(screen.getByText("Network error")).toBeTruthy();
      });
    });

    it("calls onCancel when Cancel button is clicked", () => {
      render(ce(ProjectCrud, defaultCreateProps));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(defaultCreateProps.onCancel).toHaveBeenCalled();
    });

    it("calls onCancel when overlay is clicked", () => {
      render(ce(ProjectCrud, defaultCreateProps));
      fireEvent.click(screen.getByRole("dialog").parentElement!);
      expect(defaultCreateProps.onCancel).toHaveBeenCalled();
    });

    it("creates on Enter key", async () => {
      vi.mocked(apiCall).mockResolvedValue({ ok: true });
      render(ce(ProjectCrud, defaultCreateProps));
      fireEvent.change(screen.getByPlaceholderText("Project name"), { target: { value: "New Project" } });
      fireEvent.keyDown(screen.getByPlaceholderText("Project name"), { key: "Enter" });

      await vi.waitFor(() => {
        expect(apiCall).toHaveBeenCalledWith("/projects", expect.any(Object));
      });
    });

    it("cancels on Escape key", () => {
      render(ce(ProjectCrud, defaultCreateProps));
      fireEvent.keyDown(screen.getByPlaceholderText("Project name"), { key: "Escape" });
      expect(defaultCreateProps.onCancel).toHaveBeenCalled();
    });
  });

  describe("rename mode", () => {
    it("renders rename dialog with current name", () => {
      render(ce(ProjectCrud, defaultRenameProps));
      expect(screen.getByText("Rename Project")).toBeTruthy();
      expect(screen.getByDisplayValue("Old Name")).toBeTruthy();
    });

    it("renames project on submit", async () => {
      vi.mocked(apiCall).mockResolvedValue({ ok: true });
      render(ce(ProjectCrud, defaultRenameProps));
      fireEvent.change(screen.getByPlaceholderText("Project name"), { target: { value: "New Name" } });
      fireEvent.click(screen.getByRole("button", { name: "Rename" }));

      await vi.waitFor(() => {
        expect(apiCall).toHaveBeenCalledWith(
          "/projects/p1",
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ name: "New Name" }),
          }),
        );
      });
    });

    it("calls onDone after successful rename", async () => {
      vi.mocked(apiCall).mockResolvedValue({ ok: true });
      const onDone = vi.fn();
      render(ce(ProjectCrud, { ...defaultRenameProps, onDone }));
      fireEvent.change(screen.getByPlaceholderText("Project name"), { target: { value: "New Name" } });
      fireEvent.click(screen.getByRole("button", { name: "Rename" }));

      await vi.waitFor(() => {
        expect(onDone).toHaveBeenCalled();
      });
    });
  });
});
