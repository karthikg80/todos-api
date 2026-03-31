import { loadConfig, saveConfig, clearAuth, resolveApiUrl } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function friendlyError(status: number, body: any): string {
  if (body?.error) return body.error;
  switch (status) {
    case 401:
      return "Not logged in. Run `td login` first.";
    case 403:
      return "Permission denied.";
    case 404:
      return "Not found.";
    case 409:
      return "Conflict — resource already exists.";
    case 422:
      return "Validation failed.";
    case 429:
      return "Rate limited. Try again in a moment.";
    default:
      return `Request failed (${status}).`;
  }
}

export class ApiClient {
  private apiUrl: string;

  constructor(apiUrlOverride?: string) {
    this.apiUrl = resolveApiUrl(apiUrlOverride);
  }

  async request<T = any>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const config = loadConfig();
    const url = `${this.apiUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.accessToken) {
      headers["Authorization"] = `Bearer ${config.accessToken}`;
    }

    let res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Transparent token refresh on 401
    if (res.status === 401 && config.refreshToken) {
      const refreshed = await this.tryRefresh(config.refreshToken);
      if (refreshed) {
        headers["Authorization"] = `Bearer ${refreshed}`;
        res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
      }
    }

    if (!res.ok) {
      let errorBody: any;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = {};
      }
      throw new ApiError(res.status, friendlyError(res.status, errorBody));
    }

    const text = await res.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  private async tryRefresh(refreshToken: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.apiUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        clearAuth();
        return null;
      }

      const data = (await res.json()) as {
        accessToken: string;
        refreshToken?: string;
      };
      const config = loadConfig();
      config.accessToken = data.accessToken;
      if (data.refreshToken) {
        config.refreshToken = data.refreshToken;
      }
      saveConfig(config);
      return data.accessToken;
    } catch {
      clearAuth();
      return null;
    }
  }

  get<T = any>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T = any>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  put<T = any>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  delete<T = any>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
