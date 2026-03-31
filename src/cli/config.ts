import fs from "fs";
import path from "path";
import os from "os";

export interface CliConfig {
  apiUrl: string;
  accessToken?: string;
  refreshToken?: string;
  user?: { id: string; email: string; name?: string };
}

const DEFAULT_API_URL = "http://localhost:3000";

export function getConfigDir(): string {
  return path.join(os.homedir(), ".td");
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

export function loadConfig(): CliConfig {
  const configPath = getConfigPath();
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return { apiUrl: DEFAULT_API_URL, ...parsed };
  } catch {
    return { apiUrl: DEFAULT_API_URL };
  }
}

export function saveConfig(config: CliConfig): void {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

export function clearAuth(): void {
  const config = loadConfig();
  delete config.accessToken;
  delete config.refreshToken;
  delete config.user;
  saveConfig(config);
}

export function resolveApiUrl(flagUrl?: string): string {
  if (flagUrl) return flagUrl;
  if (process.env.TD_API_URL) return process.env.TD_API_URL;
  return loadConfig().apiUrl;
}

export function isLoggedIn(): boolean {
  const config = loadConfig();
  return !!config.accessToken;
}
