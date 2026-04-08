// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { LoginForm } from "./LoginForm";
import * as authApi from "./authApi";

// Mock AuthProvider
const mockSetTokens = vi.fn();
vi.mock("./AuthProvider", () => ({
  useAuth: () => ({
    setTokens: mockSetTokens,
    user: null,
    loading: false,
  }),
}));

// Mock authApi
vi.mock("./authApi", () => ({
  login: vi.fn().mockResolvedValue({
    token: "test-token",
    refreshToken: "test-refresh",
    user: { id: "1", email: "test@example.com", name: "Test" },
  }),
  fetchProviders: vi.fn().mockResolvedValue({
    google: false,
    apple: false,
    phone: false,
  }),
}));

// Mock SocialButtons to avoid complex provider setup
vi.mock("./SocialButtons", () => ({
  SocialButtons: () => createElement("div", { "data-testid": "social-buttons" }),
}));

// Mock pageTransitions
vi.mock("../utils/pageTransitions", () => ({
  navigateWithFade: vi.fn(),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    onSwitchToForgot: vi.fn(),
    onSwitchToPhone: vi.fn(),
    onSwitchToRegister: vi.fn(),
    initialMessage: null,
  };

  it("renders email and password fields", () => {
    render(createElement(LoginForm, defaultProps));
    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    expect(emailInput).toBeTruthy();
    expect(emailInput.type).toBe("email");
    expect(passwordInput.type).toBe("password");
  });

  it("renders Login submit button", () => {
    render(createElement(LoginForm, defaultProps));
    expect(screen.getByRole("button", { name: "Login" })).toBeTruthy();
  });

  it("shows 'Forgot password?' link", () => {
    render(createElement(LoginForm, defaultProps));
    expect(screen.getByText("Forgot password?")).toBeTruthy();
  });

  it("calls onSwitchToForgot when 'Forgot password?' is clicked", () => {
    render(createElement(LoginForm, defaultProps));
    fireEvent.click(screen.getByText("Forgot password?"));
    expect(defaultProps.onSwitchToForgot).toHaveBeenCalled();
  });

  it("updates email input value on change", () => {
    render(createElement(LoginForm, defaultProps));
    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    expect(emailInput.value).toBe("test@example.com");
  });

  it("updates password input value on change", () => {
    render(createElement(LoginForm, defaultProps));
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    expect(passwordInput.value).toBe("secret");
  });

  it("shows 'Sign in with phone' link when phone provider is available", async () => {
    vi.mocked(authApi.fetchProviders).mockResolvedValue({
      google: false,
      apple: false,
      phone: true,
    });

    render(createElement(LoginForm, defaultProps));

    // fetchProviders is called in useEffect, need to wait for it
    await vi.waitFor(() => {
      expect(screen.getByText("Sign in with phone")).toBeTruthy();
    });
  });

  it("does not show 'Sign in with phone' when phone provider is not available", () => {
    vi.mocked(authApi.fetchProviders).mockResolvedValue({
      google: false,
      apple: false,
      phone: false,
    });

    render(createElement(LoginForm, defaultProps));
    expect(screen.queryByText("Sign in with phone")).toBeNull();
  });

  it("calls onSwitchToPhone when 'Sign in with phone' is clicked", async () => {
    vi.mocked(authApi.fetchProviders).mockResolvedValue({
      google: false,
      apple: false,
      phone: true,
    });

    render(createElement(LoginForm, defaultProps));

    await vi.waitFor(() => {
      fireEvent.click(screen.getByText("Sign in with phone"));
    });
    expect(defaultProps.onSwitchToPhone).toHaveBeenCalled();
  });

  it("renders SocialButtons component", () => {
    render(createElement(LoginForm, defaultProps));
    expect(screen.getByTestId("social-buttons")).toBeTruthy();
  });

  it("has correct autocomplete attributes", () => {
    render(createElement(LoginForm, defaultProps));
    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    expect(emailInput.autocomplete).toBe("email");
    expect(passwordInput.autocomplete).toBe("current-password");
  });

  it("renders with 'Welcome back' heading", () => {
    render(createElement(LoginForm, defaultProps));
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
  });
});
