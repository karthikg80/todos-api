(function initAppState(globalScope) {
  const AUTH_STATE = Object.freeze({
    AUTHENTICATED: "authenticated",
    REFRESHING: "refreshing",
    UNAUTHENTICATED: "unauthenticated",
  });

  const EMAIL_ACTION_TIMEOUT_MS = 15000;

  function loadStoredSession(storage = globalScope.localStorage) {
    const token = storage.getItem("authToken");
    const refreshToken = storage.getItem("refreshToken");
    const userRaw = storage.getItem("user");

    if (!token || !userRaw) {
      return {
        token: null,
        refreshToken,
        user: null,
        invalidUserData: false,
      };
    }

    try {
      return {
        token,
        refreshToken,
        user: JSON.parse(userRaw),
        invalidUserData: false,
      };
    } catch (error) {
      return {
        token: null,
        refreshToken: null,
        user: null,
        invalidUserData: true,
        error,
      };
    }
  }

  function persistSession({ authToken, refreshToken, currentUser }) {
    if (authToken) {
      globalScope.localStorage.setItem("authToken", authToken);
    } else {
      globalScope.localStorage.removeItem("authToken");
    }

    if (refreshToken) {
      globalScope.localStorage.setItem("refreshToken", refreshToken);
    } else {
      globalScope.localStorage.removeItem("refreshToken");
    }

    if (currentUser) {
      globalScope.localStorage.setItem("user", JSON.stringify(currentUser));
    } else {
      globalScope.localStorage.removeItem("user");
    }
  }

  function clearSession() {
    globalScope.localStorage.removeItem("authToken");
    globalScope.localStorage.removeItem("refreshToken");
    globalScope.localStorage.removeItem("user");
  }

  globalScope.AppState = {
    AUTH_STATE,
    EMAIL_ACTION_TIMEOUT_MS,
    loadStoredSession,
    persistSession,
    clearSession,
  };
})(window);
