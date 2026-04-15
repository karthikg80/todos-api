// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { ResetPasswordForm } from "./ResetPasswordForm";
import * as authApi from "./authApi";

vi.mock("./authApi", () => ({
  resetPassword: vi.fn(),
}));

const mockResetPassword = vi.mocked(authApi.resetPassword);

const defaultProps = {
  token: "reset-token-123",
  onBack: vi.fn(),
};

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("rendering", () => {
    it("renders the form with heading", () => {
      render(React.createElement(ResetPasswordForm, defaultProps));
      expect(screen.getByText("Set new password")).toBeTruthy();
    });

    it("renders password and confirm fields", () => {
      render(React.createElement(ResetPasswordForm, defaultProps));
      expect(screen.getByLabelText("New Password")).toBeTruthy();
      expect(screen.getByLabelText("Confirm Password")).toBeTruthy();
    });

    it("renders submit button", () => {
      render(React.createElement(ResetPasswordForm, defaultProps));
      expect(screen.getByRole("button", { name: "Reset Password" })).toBeTruthy();
    });

    it("does not show error message by default", () => {
      render(React.createElement(ResetPasswordForm, defaultProps));
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("validation", () => {
    it("shows error when passwords don't match", async () => {
      render(React.createElement(ResetPasswordForm, defaultProps));
      const passwordInput = screen.getByLabelText("New Password");
      const confirmInput = screen.getByLabelText("Confirm Password");
      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: "password123" } });
        fireEvent.change(confirmInput, { target: { value: "different123" } });
        fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
      });
      expect(screen.getByText("Passwords don't match")).toBeTruthy();
      expect(mockResetPassword).not.toHaveBeenCalled();
    });

    it("shows error when password is too short", async () => {
      render(React.createElement(ResetPasswordForm, defaultProps));
      const passwordInput = screen.getByLabelText("New Password");
      const confirmInput = screen.getByLabelText("Confirm Password");
      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: "short" } });
        fireEvent.change(confirmInput, { target: { value: "short" } });
        fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
      });
      expect(screen.getByText("Password must be at least 8 characters")).toBeTruthy();
      expect(mockResetPassword).not.toHaveBeenCalled();
    });

    it("clears previous error on new submission", async () => {
      render(React.createElement(ResetPasswordForm, defaultProps));
      const passwordInput = screen.getByLabelText("New Password");
      const confirmInput = screen.getByLabelText("Confirm Password");
      // First trigger an error
      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: "short" } });
        fireEvent.change(confirmInput, { target: { value: "short" } });
        fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
      });
      expect(screen.getByText("Password must be at least 8 characters")).toBeTruthy();
      // Now submit with valid data
      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: "validpassword" } });
        fireEvent.change(confirmInput, { target: { value: "validpassword" } });
        fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
      });
      expect(screen.queryByText("Password must be at least 8 characters")).toBeNull();
    });
  });

  describe("successful reset", () => {
    it("calls resetPassword API with token and password", async () => {
      mockResetPassword.mockResolvedValueOnce(undefined);
      render(React.createElement(ResetPasswordForm, defaultProps));
      const passwordInput = screen.getByLabelText("New Password");
      const confirmInput = screen.getByLabelText("Confirm Password");
      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: "validpassword" } });
        fireEvent.change(confirmInput, { target: { value: "validpassword" } });
        fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
      });
      expect(mockResetPassword).toHaveBeenCalledWith("reset-token-123", "validpassword");
    });

    it("shows success message after reset", async () => {
      mockResetPassword.mockResolvedValueOnce(undefined);
      render(React.createElement(ResetPasswordForm, defaultProps));
      const passwordInput = screen.getByLabelText("New Password");
      const confirmInput = screen.getByLabelText("Confirm Password");
      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: "validpassword" } });
        fireEvent.change(confirmInput, { target: { value: "validpassword" } });
        fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
      });
      // Let microtasks flush
      await act(async () => {});
      await act(async () => {});
      expect(screen.getByText("Password reset")).toBeTruthy();
    });

    it("calls onBack after 2 seconds on success", async () => {
      mockResetPassword.mockResolvedValueOnce(undefined);
      render(React.createElement(ResetPasswordForm, defaultProps));
      const passwordInput = screen.getByLabelText("New Password");
      const confirmInput = screen.getByLabelText("Confirm Password");
      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: "validpassword" } });
        fireEvent.change(confirmInput, { target: { value: "validpassword" } });
        fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
      });
      // Let microtasks flush
      await act(async () => {});
      await act(async () => {});
      expect(screen.getByText("Password reset")).toBeTruthy();
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(defaultProps.onBack).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("shows error message when reset fails", async () => {
      mockResetPassword.mockRejectedValueOnce(new Error("Invalid token"));
      render(React.createElement(ResetPasswordForm, defaultProps));
      const passwordInput = screen.getByLabelText("New Password");
      const confirmInput = screen.getByLabelText("Confirm Password");
      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: "validpassword" } });
        fireEvent.change(confirmInput, { target: { value: "validpassword" } });
        fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
      });
      // Let microtasks flush
      await act(async () => {});
      await act(async () => {});
      expect(screen.getByText("Invalid token")).toBeTruthy();
    });

    it("shows generic error for non-Error objects", async () => {
      mockResetPassword.mockRejectedValueOnce("string error");
      render(React.createElement(ResetPasswordForm, defaultProps));
      const passwordInput = screen.getByLabelText("New Password");
      const confirmInput = screen.getByLabelText("Confirm Password");
      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: "validpassword" } });
        fireEvent.change(confirmInput, { target: { value: "validpassword" } });
        fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
      });
      // Let microtasks flush
      await act(async () => {});
      await act(async () => {});
      expect(screen.getByText("Reset failed")).toBeTruthy();
    });
  });

  describe("disabled state", () => {
    it("disables submit button while submitting", async () => {
      mockResetPassword.mockImplementationOnce(() => new Promise(() => {}));
      render(React.createElement(ResetPasswordForm, defaultProps));
      const passwordInput = screen.getByLabelText("New Password");
      const confirmInput = screen.getByLabelText("Confirm Password");
      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: "validpassword" } });
        fireEvent.change(confirmInput, { target: { value: "validpassword" } });
        fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
      });
      expect(screen.getByRole("button", { name: "Resetting…" })).toBeDisabled();
    });
  });
});
