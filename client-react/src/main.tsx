import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { fadeInOnLoad } from "./utils/pageTransitions";

fadeInOnLoad();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
