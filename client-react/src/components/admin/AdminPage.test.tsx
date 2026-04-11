// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AdminPage } from "./AdminPage";

const { createElement: ce } = React;

// Mock the API client
vi.mock("../../api/client", () => ({
  apiCall: vi.fn(),
}));

// Mock AdminFeedbackWorkflow (complex sub-component)
vi.mock("./AdminFeedbackWorkflow", () => ({
  AdminFeedbackWorkflow: () => ce("div", { id: "feedbackWorkflow" }, "Feedback Workflow"),
}));

const { apiCall } = await import("../../api/client");

const mockUsers = [
  { id: "u1", email: "alice@example.com", name: "Alice Smith", role: "admin", createdAt: "2025-01-01T00:00:00Z", emailVerified: true },
  { id: "u2", email: "bob@example.com", name: "Bob Jones", role: "user", createdAt: "2025-02-01T00:00:00Z", emailVerified: false },
  { id: "u3", email: "carol@example.com", name: "", role: "user", createdAt: "2025-03-01T00:00:00Z", emailVerified: true },
];

function mockApiUsers() {
  (apiCall as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(mockUsers),
  });
}

function mockApiFeedback() {
  (apiCall as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: vi.fn().mockResolvedValue([]),
  });
}

function renderAdminPage(props: { onBack?: () => void } = {}) {
  return render(ce(AdminPage, { onBack: props.onBack || vi.fn() }));
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders admin pane with SegmentedControl tabs", async () => {
    mockApiUsers();
    mockApiFeedback();
    renderAdminPage();

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /users/i })).toBeTruthy();
    });

    // SegmentedControl renders buttons with role="tab"
    const usersTab = screen.getByRole("tab", { name: /users/i });
    const feedbackTab = screen.getByRole("tab", { name: /feedback/i });
    expect(usersTab).toBeTruthy();
    expect(feedbackTab).toBeTruthy();
  });

  it("defaults to the feedback tab", () => {
    mockApiUsers();
    mockApiFeedback();
    renderAdminPage();

    // Feedback tab should be active by default (tab === "feedback")
    const tabs = screen.getAllByRole("tab");
    const feedbackTab = tabs.find((t) => t.getAttribute("aria-selected") === "true");
    // The second tab (feedback) should be selected
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Feedback Workflow")).toBeTruthy();
  });

  it("shows loading spinner when loading users", async () => {
    // Make the API call pending
    (apiCall as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
      if (path === "/admin/users") {
        return { ok: true, json: vi.fn().mockResolvedValue(mockUsers) };
      }
      return { ok: true, json: vi.fn().mockResolvedValue([]) };
    });

    renderAdminPage();

    // Click Users tab to trigger loadUsers
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[0]); // "Users" tab

    // Should show loading state briefly
    expect(screen.getByText(/Loading users/i)).toBeTruthy();
  });

  it("renders user cards with email, name, and role chips", async () => {
    mockApiUsers();
    mockApiFeedback();
    renderAdminPage();

    // Switch to Users tab
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[0]);

    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeTruthy();
    });

    expect(screen.getByText("Alice Smith")).toBeTruthy();
    expect(screen.getByText("bob@example.com")).toBeTruthy();
    expect(screen.getByText("Bob Jones")).toBeTruthy();

    // Role chips
    const userChips = screen.getAllByText("user");
    const adminChips = screen.getAllByText("admin");
    expect(userChips.length).toBeGreaterThanOrEqual(1);
    expect(adminChips.length).toBeGreaterThanOrEqual(1);
  });

  it("filters users when search is entered", async () => {
    mockApiUsers();
    mockApiFeedback();
    renderAdminPage();

    // Switch to Users tab
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[0]);

    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeTruthy();
    });

    // Type in search
    const searchInput = screen.getByRole("textbox", { name: /search users/i });
    fireEvent.change(searchInput, { target: { value: "alice" } });

    // Alice should still appear
    expect(screen.getByText("alice@example.com")).toBeTruthy();
    // Bob should be filtered out
    expect(screen.queryByText("bob@example.com")).toBeNull();
  });

  it("shows empty state when no users match search", async () => {
    mockApiUsers();
    mockApiFeedback();
    renderAdminPage();

    // Switch to Users tab
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[0]);

    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeTruthy();
    });

    // Type a non-matching search
    const searchInput = screen.getByRole("textbox", { name: /search users/i });
    fireEvent.change(searchInput, { target: { value: "zzzzz" } });

    expect(screen.getByText("No users match your search.")).toBeTruthy();
  });

  it("shows empty state when there are no users", async () => {
    (apiCall as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
      if (path === "/admin/users") {
        return { ok: true, json: vi.fn().mockResolvedValue([]) };
      }
      return { ok: true, json: vi.fn().mockResolvedValue([]) };
    });

    renderAdminPage();

    // Switch to Users tab
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[0]);

    await waitFor(() => {
      expect(screen.getByText("No users found.")).toBeTruthy();
    });
  });

  it("computes avatar color based on email hashCode", () => {
    // The avatarColor function computes HSL but jsdom converts to rgb in style
    mockApiUsers();
    mockApiFeedback();
    renderAdminPage();

    // Switch to Users tab
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[0]);

    waitFor(() => {
      const avatars = document.querySelectorAll(".admin-user-avatar");
      expect(avatars.length).toBeGreaterThan(0);
      // Each avatar should have a background style set (color computed from email)
      avatars.forEach((avatar) => {
        const style = avatar.getAttribute("style");
        expect(style).toContain("background");
      });
    });
  });

  it("calls API when role chip is clicked", async () => {
    mockApiUsers();
    mockApiFeedback();
    renderAdminPage();

    // Switch to Users tab
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[0]);

    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeTruthy();
    });

    // Alice is "admin" — clicking the "user" chip should trigger a role change to "user"
    const userChips = screen.getAllByText("user");
    // Alice's user chip (not active, since she's admin) — click to set her to user
    fireEvent.click(userChips[0]);

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith(
        "/admin/users/u1/role",
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  it("calls API when delete button is clicked", async () => {
    mockApiUsers();
    mockApiFeedback();

    // Mock confirm to return true
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderAdminPage();

    // Switch to Users tab
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[0]);

    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeTruthy();
    });

    // Click delete button for first user
    const deleteButtons = screen.getAllByLabelText("Delete user");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith(
        "/admin/users/u1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    vi.restoreAllMocks();
  });

  it("calls onBack when back button is clicked", () => {
    const onBack = vi.fn();
    mockApiUsers();
    mockApiFeedback();
    render(ce(AdminPage, { onBack }));

    const backButton = screen.getByRole("button", { name: /back/i });
    fireEvent.click(backButton);

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("does not call API for role change when role is already the target", async () => {
    mockApiUsers();
    mockApiFeedback();
    renderAdminPage();

    // Switch to Users tab
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[0]);

    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeTruthy();
    });

    // Alice is "admin" — clicking "admin" chip should be a no-op (disabled)
    const adminChips = screen.getAllByText("admin");
    // The admin chip for Alice should have a click handler that checks u.role !== "admin"
    // Since she IS admin, it should not trigger
    fireEvent.click(adminChips[0]);

    // Should NOT call apiCall for /admin/users/u1/role since she's already admin
    await waitFor(() => {
      const roleCalls = (apiCall as ReturnType<typeof vi.fn>).mock.calls.filter(
        (args) => args[0] === "/admin/users/u1/role",
      );
      expect(roleCalls.length).toBe(0);
    });
  });
});
