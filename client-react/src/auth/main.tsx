import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthPage } from "./AuthPage";
import { AuthProvider } from "./AuthProvider";
import { fadeInOnLoad } from "../utils/pageTransitions";

fadeInOnLoad();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AuthPage />
    </AuthProvider>
  </StrictMode>,
);
