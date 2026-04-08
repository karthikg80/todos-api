// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { RegisterForm } from "./RegisterForm";
import * as authApi from "./authApi";

// Mock AuthProvider
vi.mock("./AuthProvider", () => ({
  useAuth: () => ({
    setTokens: vi.fn(),
    user: null,
    loading: false,
  }),
}));

// Mock authApi
vi.mock("./authApi", () => ({
  register: vi.fn().mockResolvedValue({
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

// Mock SocialButtons
vi.mock("./SocialButtons", () => ({
  SocialButtons: () => createElement("div", { "data-testid": "social-buttons" }),
}));

// Mock pageTransitions
vi.mock("../utils/pageTransitions", () => ({
  navigateWithFade: vi.fn(),
}));

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    onSwitchToLogin: vi.fn(),
    onSwitchToPhone: vi.fn(),
  };

  it("renders name, email, and password fields", () => {
    render(createElement(RegisterForm, defaultProps));
    expect(screen.getByLabelText("Name (optional)")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });

  it("renders Create Account submit button", () => {
    render(createElement(RegisterForm, defaultProps));
    expect(screen.getByRole("button", { name: "Create Account" })).toBeTruthy();
  });

  it("shows 'Already have an account?' link", () => {
    render(createElement(RegisterForm, defaultProps));
    expect(screen.getByText("Already have an account? Log in")).toBeTruthy();
  });

  it("calls onSwitchToLogin when login link is clicked", () => {
    render(createElement(RegisterForm, defaultProps));
    fireEvent.click(screen.getByText("Already have an account? Log in"));
    expect(defaultProps.onSwitchToLogin).toHaveBeenCalled();
  });

  it("updates name input value on change", () => {
    render(createElement(RegisterForm, defaultProps));
    const nameInput = screen.getByLabelText("Name (optional)") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Jane Doe" } });
    expect(nameInput.value).toBe("Jane Doe");
  });

  it("updates email input value on change", () => {
    render(createElement(RegisterForm, defaultProps));
    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: "jane@example.com" } });
    expect(emailInput.value).toBe("jane@example.com");
  });

  it("updates password input value on change", () => {
    render(createElement(RegisterForm, defaultProps));
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    expect(passwordInput.value).toBe("password123");
  });

  it("shows 'Sign up with phone' link when phone provider is available", async () => {
    vi.mocked(authApi.fetchProviders).mockResolvedValue({
      google: false,
      apple: false,
      phone: true,
    });

    render(createElement(RegisterForm, defaultProps));

    await vi.waitFor(() => {
      expect(screen.getByText("Sign up with phone")).toBeTruthy();
    });
  });

  it("does not show 'Sign up with phone' when phone provider is not available", () => {
    vi.mocked(authApi.fetchProviders).mockResolvedValue({
      google: false,
      apple: false,
      phone: false,
    });

    render(createElement(RegisterForm, defaultProps));
    expect(screen.queryByText("Sign up with phone")).toBeNull();
  });

  it("calls onSwitchToPhone when 'Sign up with phone' is clicked", async () => {
    vi.mocked(authApi.fetchProviders).mockResolvedValue({
      google: false,
      apple: false,
      phone: true,
    });

    render(createElement(RegisterForm, defaultProps));

    await vi.waitFor(() => {
      fireEvent.click(screen.getByText("Sign up with phone"));
    });
    expect(defaultProps.onSwitchToPhone).toHaveBeenCalled();
  });

  it("renders SocialButtons component", () => {
    render(createElement(RegisterForm, defaultProps));
    expect(screen.getByTestId("social-buttons")).toBeTruthy();
  });

  it("has correct autocomplete attributes", () => {
    render(createElement(RegisterForm, defaultProps));
    const nameInput = screen.getByLabelText("Name (optional)") as HTMLInputElement;
    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    expect(nameInput.autocomplete).toBe("name");
    expect(emailInput.autocomplete).toBe("email");
    expect(passwordInput.autocomplete).toBe("new-password");
  });

  it("renders with 'Create your account' heading", () => {
    render(createElement(RegisterForm, defaultProps));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeTruthy();
  });

  it("has password minLength attribute", () => {
    render(createElement(RegisterForm, defaultProps));
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    expect(passwordInput.minLength).toBe(8);
  });
});
