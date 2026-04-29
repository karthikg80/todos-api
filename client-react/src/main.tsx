import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { App } from "./App";
import { fadeInOnLoad } from "./utils/pageTransitions";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  const parsedRate = Number.parseFloat(
    (import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string | undefined) ??
      "",
  );
  Sentry.init({
    dsn: sentryDsn,
    environment:
      (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ||
      import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    tracesSampleRate:
      Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 1
        ? parsedRate
        : 0.1,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
  });
}

fadeInOnLoad();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
