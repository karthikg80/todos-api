import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  const parsedRate = Number.parseFloat(
    process.env.SENTRY_TRACES_SAMPLE_RATE ?? "",
  );
  const tracesSampleRate =
    Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 1
      ? parsedRate
      : 0.1;

  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release:
      process.env.SENTRY_RELEASE ||
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      undefined,
    tracesSampleRate,
    sendDefaultPii: false,
  });
}
