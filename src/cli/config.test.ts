import fs from "fs";
import path from "path";
import os from "os";

// Override config dir before importing module
let testDir: string;
jest.mock("os", () => {
  const actual = jest.requireActual("os");
  return {
    ...actual,
    homedir: () => testDir,
  };
});

import {
  loadConfig,
  saveConfig,
  clearAuth,
  getConfigDir,
  getConfigPath,
  resolveApiUrl,
  isLoggedIn,
} from "./config";

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "td-test-"));
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
  delete process.env.TD_API_URL;
});

describe("config", () => {
  test("loadConfig returns defaults when no file exists", () => {
    const config = loadConfig();
    expect(config.apiUrl).toBe("http://localhost:3000");
    expect(config.accessToken).toBeUndefined();
  });

  test("saveConfig creates dir and writes file", () => {
    saveConfig({
      apiUrl: "http://example.com",
      accessToken: "tok123",
      refreshToken: "ref456",
      user: { id: "u1", email: "a@b.com" },
    });

    const raw = fs.readFileSync(getConfigPath(), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.apiUrl).toBe("http://example.com");
    expect(parsed.accessToken).toBe("tok123");

    // Verify file permissions (0o600)
    const stat = fs.statSync(getConfigPath());
    expect(stat.mode & 0o777).toBe(0o600);
  });

  test("loadConfig reads saved config", () => {
    saveConfig({
      apiUrl: "http://custom.api",
      accessToken: "abc",
      user: { id: "u1", email: "test@test.com" },
    });

    const config = loadConfig();
    expect(config.apiUrl).toBe("http://custom.api");
    expect(config.accessToken).toBe("abc");
    expect(config.user?.email).toBe("test@test.com");
  });

  test("clearAuth removes tokens but preserves apiUrl", () => {
    saveConfig({
      apiUrl: "http://my.api",
      accessToken: "tok",
      refreshToken: "ref",
      user: { id: "u1", email: "a@b.com" },
    });

    clearAuth();

    const config = loadConfig();
    expect(config.apiUrl).toBe("http://my.api");
    expect(config.accessToken).toBeUndefined();
    expect(config.refreshToken).toBeUndefined();
    expect(config.user).toBeUndefined();
  });

  test("isLoggedIn returns false when no token", () => {
    expect(isLoggedIn()).toBe(false);
  });

  test("isLoggedIn returns true when token exists", () => {
    saveConfig({ apiUrl: "http://localhost:3000", accessToken: "tok" });
    expect(isLoggedIn()).toBe(true);
  });

  test("resolveApiUrl prioritizes flag over env over config", () => {
    saveConfig({ apiUrl: "http://from-config" });
    expect(resolveApiUrl()).toBe("http://from-config");

    process.env.TD_API_URL = "http://from-env";
    expect(resolveApiUrl()).toBe("http://from-env");

    expect(resolveApiUrl("http://from-flag")).toBe("http://from-flag");
  });

  test("getConfigDir points to ~/.td", () => {
    expect(getConfigDir()).toBe(path.join(testDir, ".td"));
  });
});
