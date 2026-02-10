function createApiClient({
  apiUrl,
  getAuthToken,
  getRefreshToken,
  getAuthState,
  setAuthState,
  onAuthFailure,
  onAuthTokens,
}) {
  let refreshInFlight = null;

  async function parseApiBody(response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  }

  function isAbortError(error) {
    return error instanceof Error && error.name === "AbortError";
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      setAuthState("unauthenticated");
      return false;
    }

    if (refreshInFlight) {
      return refreshInFlight;
    }

    setAuthState("refreshing");

    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          setAuthState("unauthenticated");
          return false;
        }

        const data = await response.json();
        onAuthTokens(data.token, data.refreshToken);
        setAuthState("authenticated");
        return true;
      } catch (error) {
        console.error("Token refresh failed:", error);
        setAuthState("unauthenticated");
        return false;
      }
    })();

    const refreshed = await refreshInFlight;
    refreshInFlight = null;
    return refreshed;
  }

  async function apiCall(url, options = {}) {
    const requestOptions = {
      ...options,
      headers: {
        ...(options.headers || {}),
      },
    };

    const authToken = getAuthToken();
    if (authToken && !requestOptions.skipAuth) {
      requestOptions.headers.Authorization = `Bearer ${authToken}`;
    }

    let response = await fetch(url, requestOptions);

    if (
      response.status === 401 &&
      getRefreshToken() &&
      !requestOptions.skipRefresh
    ) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        requestOptions.headers.Authorization = `Bearer ${getAuthToken()}`;
        response = await fetch(url, requestOptions);
      } else {
        onAuthFailure();
        return response;
      }
    }

    if (
      response.status === 401 &&
      !getRefreshToken() &&
      !requestOptions.skipAuth
    ) {
      if (getAuthState() !== "unauthenticated") {
        setAuthState("unauthenticated");
      }
      onAuthFailure();
    }

    return response;
  }

  async function apiCallWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await apiCall(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    apiCall,
    fetchWithTimeout,
    apiCallWithTimeout,
    parseApiBody,
    isAbortError,
  };
}

window.ApiClient = {
  createApiClient,
};
