import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "../types";
import { apiCall } from "../api/client";
import { navigateWithFade } from "../utils/pageTransitions";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  logout: () => void;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: () => {},
  setUser: () => {},
  refreshUser: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const persistUser = useCallback((nextUser: User | null) => {
    setUser(nextUser);
    if (nextUser) {
      localStorage.setItem("user", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("user");
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const res = await apiCall("/users/me");
    if (!res.ok) {
      throw new Error("Failed to fetch user");
    }
    const data = (await res.json()) as User;
    persistUser(data);
    return data;
  }, [persistUser]);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setLoading(false);
      return;
    }

    refreshUser()
      .catch(() => {
        // Keep locally stored user if API fails (offline, etc.)
      })
      .finally(() => setLoading(false));
  }, [refreshUser]);

  const logout = useCallback(() => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("refreshToken");
    persistUser(null);
    navigateWithFade("/", { replace: true });
  }, [persistUser]);

  return (
    <AuthContext.Provider
      value={{ user, loading, logout, setUser: persistUser, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
