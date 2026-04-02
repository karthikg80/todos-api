import { useEffect } from "react";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { AppShell } from "./components/layout/AppShell";
import "./styles/app.css";
import { navigateWithFade } from "./utils/pageTransitions";

function AuthGate() {
  const { user, loading } = useAuth();
  const hasToken =
    typeof window !== "undefined" && !!localStorage.getItem("authToken");

  useEffect(() => {
    if (!loading && !user && !hasToken) {
      navigateWithFade("/auth?next=/app", { replace: true });
    }
  }, [hasToken, loading, user]);

  if (loading) {
    return (
      <div id="todosView">
        <div id="todosContent">
          <div className="loading">Loading…</div>
        </div>
      </div>
    );
  }

  if (!user && !hasToken) {
    return null;
  }

  return (
    <div id="todosView" className="active">
      <div id="todosContent">
        <AppShell />
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
