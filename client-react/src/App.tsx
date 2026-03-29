import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { AppShell } from "./components/layout/AppShell";
import "./styles/app.css";

function AuthGate() {
  const { user, loading } = useAuth();

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
    // Check if we have a token but user fetch is still pending
    const token = localStorage.getItem("authToken");
    if (!token) {
      window.location.href = "/auth?next=/app-react";
      return null;
    }
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
