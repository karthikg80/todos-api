// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VerificationBanner } from "./VerificationBanner";
import * as apiClient from "../../api/client";

vi.mock("../../api/client", () => ({
  apiCall: vi.fn(),
}));

describe("VerificationBanner", () => {
  it("renders nothing when user is verified", () => {
    render(createElement(VerificationBanner, {
      email: "test@example.com",
      isVerified: true,
    }));
    expect(screen.queryByRole("banner")).toBeNull();
    expect(document.getElementById("verificationBanner")).toBeNull();
  });

  it("renders nothing when dismissed", () => {
    render(createElement(VerificationBanner, {
      email: "test@example.com",
      isVerified: false,
    }));
    expect(screen.getByText(/Please verify your email/)).toBeTruthy();

    // Click dismiss
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText(/Please verify your email/)).toBeNull();
  });

  it("renders email verification message", () => {
    render(createElement(VerificationBanner, {
      email: "test@example.com",
      isVerified: false,
    }));
    expect(screen.getByText(/Please verify your email/)).toBeTruthy();
    expect(screen.getByText("test@example.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resend" })).toBeTruthy();
  });

  it("sends resend request when Resend button is clicked", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(null, { status: 200 }));

    render(createElement(VerificationBanner, {
      email: "test@example.com",
      isVerified: false,
    }));

    fireEvent.click(screen.getByRole("button", { name: "Resend" }));

    await waitFor(() => {
      expect(apiClient.apiCall).toHaveBeenCalledWith("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
      });
    });
  });

  it("shows 'Sent!' after successful resend", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(null, { status: 200 }));

    render(createElement(VerificationBanner, {
      email: "test@example.com",
      isVerified: false,
    }));

    fireEvent.click(screen.getByRole("button", { name: "Resend" }));

    await waitFor(() => {
      expect(screen.getByText("Sent!")).toBeTruthy();
    });
  });

  it("shows error message when resend fails", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(
      JSON.stringify({ error: "Rate limited" }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    ));

    render(createElement(VerificationBanner, {
      email: "test@example.com",
      isVerified: false,
    }));

    fireEvent.click(screen.getByRole("button", { name: "Resend" }));

    await waitFor(() => {
      expect(screen.getByText("Rate limited")).toBeTruthy();
    });
  });

  it("shows generic error when response has no error message", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(
      JSON.stringify({}),
      { status: 500, headers: { "Content-Type": "application/json" } },
    ));

    render(createElement(VerificationBanner, {
      email: "test@example.com",
      isVerified: false,
    }));

    fireEvent.click(screen.getByRole("button", { name: "Resend" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to send")).toBeTruthy();
    });
  });

  it("shows 'Sending...' while request is in progress", async () => {
    let resolveRequest: () => void;
    const requestPromise = new Promise<void>((r) => {
      resolveRequest = r;
    });
    vi.mocked(apiClient.apiCall).mockReturnValue(requestPromise as any);

    render(createElement(VerificationBanner, {
      email: "test@example.com",
      isVerified: false,
    }));

    fireEvent.click(screen.getByRole("button", { name: "Resend" }));

    // Button should show "Sending..."
    await waitFor(() => {
      expect(screen.getByText("Sending…")).toBeTruthy();
    });

    resolveRequest!();
  });
});
