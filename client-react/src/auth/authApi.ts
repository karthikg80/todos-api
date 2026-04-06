import { apiCall } from "../api/client";

export interface AuthTokens {
  token: string;
  refreshToken: string;
  user: { id: string; email: string; name: string };
}

export interface AuthProviders {
  google: boolean;
  apple: boolean;
  phone: boolean;
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const res = await apiCall("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(err.error ?? "Login failed");
  }
  return res.json();
}

export async function register(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthTokens> {
  const res = await apiCall("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Registration failed" }));
    throw new Error(err.error ?? "Registration failed");
  }
  return res.json();
}

export async function forgotPassword(email: string): Promise<void> {
  const res = await apiCall("/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const res = await apiCall("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Reset failed" }));
    throw new Error(err.error ?? "Reset failed");
  }
}

export async function fetchProviders(): Promise<AuthProviders> {
  const res = await apiCall("/auth/providers");
  if (!res.ok) return { google: false, apple: false, phone: false };
  return res.json();
}

export async function sendOtp(phone: string): Promise<void> {
  const res = await apiCall("/auth/phone/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Send failed" }));
    throw new Error(err.error ?? "Send failed");
  }
}

export async function verifyOtp(phone: string, code: string): Promise<AuthTokens> {
  const res = await apiCall("/auth/phone/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Verification failed" }));
    throw new Error(err.error ?? "Verification failed");
  }
  return res.json();
}
