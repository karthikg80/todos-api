// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  login,
  register,
  forgotPassword,
  resetPassword,
  fetchProviders,
  sendOtp,
  verifyOtp,
} from "./authApi";
import * as apiClient from "../api/client";

vi.mock("../api/client", () => ({
  apiCall: vi.fn(),
}));

const mockTokens = {
  token: "mock-token",
  refreshToken: "mock-refresh",
  user: { id: "u1", email: "test@example.com", name: "Test User" },
};

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("returns tokens on success", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({
        ok: true,
        json: async () => mockTokens,
      });
      const result = await login("test@example.com", "password");
      expect(result).toEqual(mockTokens);
      expect(apiClient.apiCall).toHaveBeenCalledWith(
        "/auth/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "test@example.com", password: "password" }),
        }),
      );
    });

    it("throws error on failure with message", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Invalid credentials" }),
      });
      await expect(login("test@example.com", "wrong")).rejects.toThrow("Invalid credentials");
    });

    it("throws generic error when no error message", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({
        ok: false,
        json: async () => ({}),
      });
      await expect(login("test@example.com", "wrong")).rejects.toThrow("Login failed");
    });

    it("throws generic error when json parsing fails", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({
        ok: false,
        json: async () => { throw new Error("Parse error"); },
      });
      await expect(login("test@example.com", "wrong")).rejects.toThrow("Login failed");
    });
  });

  describe("register", () => {
    it("returns tokens on success with name", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({
        ok: true,
        json: async () => mockTokens,
      });
      const result = await register({ email: "test@example.com", password: "password", name: "Test" });
      expect(result).toEqual(mockTokens);
    });

    it("returns tokens on success without name", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({
        ok: true,
        json: async () => mockTokens,
      });
      const result = await register({ email: "test@example.com", password: "password" });
      expect(result).toEqual(mockTokens);
    });

    it("throws error on failure", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Email already exists" }),
      });
      await expect(register({ email: "test@example.com", password: "password" })).rejects.toThrow("Email already exists");
    });
  });

  describe("forgotPassword", () => {
    it("resolves on success", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({ ok: true });
      await expect(forgotPassword("test@example.com")).resolves.toBeUndefined();
    });

    it("throws error on failure", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Email not found" }),
      });
      await expect(forgotPassword("unknown@example.com")).rejects.toThrow("Email not found");
    });
  });

  describe("resetPassword", () => {
    it("resolves on success", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({ ok: true });
      await expect(resetPassword("token123", "newpassword")).resolves.toBeUndefined();
    });

    it("throws error on failure", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Invalid token" }),
      });
      await expect(resetPassword("bad-token", "newpassword")).rejects.toThrow("Invalid token");
    });
  });

  describe("fetchProviders", () => {
    it("returns providers on success", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({
        ok: true,
        json: async () => ({ google: true, apple: false, phone: true }),
      });
      const result = await fetchProviders();
      expect(result).toEqual({ google: true, apple: false, phone: true });
    });

    it("returns all false on failure", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({ ok: false });
      const result = await fetchProviders();
      expect(result).toEqual({ google: false, apple: false, phone: false });
    });
  });

  describe("sendOtp", () => {
    it("resolves on success", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({ ok: true });
      await expect(sendOtp("+15550001234")).resolves.toBeUndefined();
    });

    it("throws error on failure", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Invalid phone number" }),
      });
      await expect(sendOtp("invalid")).rejects.toThrow("Invalid phone number");
    });
  });

  describe("verifyOtp", () => {
    it("returns tokens on success", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({
        ok: true,
        json: async () => mockTokens,
      });
      const result = await verifyOtp("+15550001234", "123456");
      expect(result).toEqual(mockTokens);
    });

    it("throws error on failure", async () => {
      vi.mocked(apiClient.apiCall).mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Invalid code" }),
      });
      await expect(verifyOtp("+15550001234", "000000")).rejects.toThrow("Invalid code");
    });
  });
});
