import { useEffect } from "react";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { AuthPage } from "./auth/AuthPage";
import { AppShell } from "./components/layout/AppShell";
import { MobileShell } from "./mobile/MobileShell";
import { useIsMobile } from "./hooks/useIsMobile";
import "./styles/app.css";
import { navigateWithFade } from "./utils/pageTransitions";

function AuthGate() {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!loading && !user) {
      navigateWithFade("/auth?next=/app", { replace: true });
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div id="todosView">
        <div id="todosContent">
          <div className="loading">Loading…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (isMobile) {
    return (
      <div id="todosView" className="active">
        <div id="todosContent">
          <MobileShell />
        </div>
      </div>
    );
  }

  return (
    <div id="todosView" className="active">
      <div id="todosContent">
        <AppShell />
      </div>
    </div>
  );
}

function AppContent() {
  // If we're at /auth, render the auth page directly (no auth gate needed)
  if (window.location.pathname === "/auth") {
    return (
      <AuthProvider>
        <AuthPage />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export function App() {
  return <AppContent />;
}
