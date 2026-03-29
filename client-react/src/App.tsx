import { useEffect, useState } from "react";

type AppState = "loading" | "unauthenticated" | "ready";

export function App() {
  const [state, setState] = useState<AppState>("loading");

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      window.location.href = `/auth?next=/app-react`;
      setState("unauthenticated");
      return;
    }
    setState("ready");
  }, []);

  if (state === "loading" || state === "unauthenticated") {
    return (
      <div id="todosView">
        <div id="todosContent">
          <div className="loading">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div id="todosView" className="active">
      <div id="todosContent">
        <p>React preview — authenticated workspace shell.</p>
      </div>
    </div>
  );
}
