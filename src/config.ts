import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const insecureDefaultJwtSecret = "your-secret-key-change-in-production";
const nodeEnv = process.env.NODE_ENV || "development";
const accessJwtSecret =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  insecureDefaultJwtSecret;
const refreshJwtSecret =
  process.env.JWT_REFRESH_SECRET ||
  process.env.JWT_SECRET ||
  insecureDefaultJwtSecret;
const testDatabaseUrlEnvRaw = process.env.TEST_DATABASE_URL;
const testDatabaseUrlFromAlias =
  typeof testDatabaseUrlEnvRaw === "string" ? testDatabaseUrlEnvRaw.trim() : "";
const databaseUrlTestRaw = (process.env.DATABASE_URL_TEST || "").trim();
const databaseUrl =
  nodeEnv === "test"
    ? testDatabaseUrlFromAlias || databaseUrlTestRaw
    : process.env.DATABASE_URL;
const allowLegacyPlaintextRefreshTokenFallback =
  (
    process.env.ALLOW_LEGACY_PLAINTEXT_REFRESH_TOKEN || "false"
  ).toLowerCase() === "true";
const legacyRefreshTokenFallbackUntilRaw = (
  process.env.LEGACY_REFRESH_TOKEN_FALLBACK_UNTIL || "2026-12-31T23:59:59.000Z"
).trim();
const legacyRefreshTokenFallbackUntilDate = new Date(
  legacyRefreshTokenFallbackUntilRaw,
);
const legacyRefreshTokenFallbackUntil = Number.isNaN(
  legacyRefreshTokenFallbackUntilDate.getTime(),
)
  ? null
  : legacyRefreshTokenFallbackUntilDate;
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const adminBootstrapSecret =
  nodeEnv === "test"
    ? process.env.ADMIN_BOOTSTRAP_SECRET || "test-admin-bootstrap-secret"
    : (process.env.ADMIN_BOOTSTRAP_SECRET || "").trim();
const emailFeaturesEnabled =
  (process.env.EMAIL_FEATURES_ENABLED || "true").toLowerCase() === "true";
const smtpHost = (process.env.SMTP_HOST || "").trim();
const smtpPortRaw = (process.env.SMTP_PORT || "").trim();
const smtpPort = smtpPortRaw ? Number.parseInt(smtpPortRaw, 10) : NaN;
const smtpUser = (process.env.SMTP_USER || "").trim();
const smtpPass = (process.env.SMTP_PASS || "").trim();
const smtpFrom = (process.env.SMTP_FROM || "").trim();
const baseUrl = (process.env.BASE_URL || "").trim();
const aiProviderEnabled =
  (process.env.AI_PROVIDER_ENABLED || "false").toLowerCase() === "true";
const aiProviderBaseUrl = (
  process.env.AI_PROVIDER_BASE_URL || "https://api.openai.com/v1"
).trim();
const aiProviderApiKey = (process.env.AI_PROVIDER_API_KEY || "").trim();
const aiProviderModel = (process.env.AI_PROVIDER_MODEL || "gpt-4o-mini").trim();
const aiDailySuggestionLimitRaw = (
  process.env.AI_DAILY_SUGGESTION_LIMIT || "50"
).trim();
const aiDailySuggestionLimit = Number.parseInt(aiDailySuggestionLimitRaw, 10);
const aiDailySuggestionLimitFreeRaw = (
  process.env.AI_DAILY_SUGGESTION_LIMIT_FREE || ""
).trim();
const aiDailySuggestionLimitProRaw = (
  process.env.AI_DAILY_SUGGESTION_LIMIT_PRO || ""
).trim();
const aiDailySuggestionLimitTeamRaw = (
  process.env.AI_DAILY_SUGGESTION_LIMIT_TEAM || ""
).trim();
const aiDailySuggestionLimitFree = Number.parseInt(
  aiDailySuggestionLimitFreeRaw,
  10,
);
const aiDailySuggestionLimitPro = Number.parseInt(
  aiDailySuggestionLimitProRaw,
  10,
);
const aiDailySuggestionLimitTeam = Number.parseInt(
  aiDailySuggestionLimitTeamRaw,
  10,
);

if (nodeEnv === "production") {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set in production");
  }

  if (accessJwtSecret === insecureDefaultJwtSecret) {
    throw new Error(
      "JWT_ACCESS_SECRET must be set to a strong non-default value in production",
    );
  }

  if (refreshJwtSecret === insecureDefaultJwtSecret) {
    throw new Error(
      "JWT_REFRESH_SECRET must be set to a strong non-default value in production",
    );
  }

  if (accessJwtSecret === refreshJwtSecret) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production",
    );
  }

  if (corsOrigins.length === 0) {
    throw new Error("CORS_ORIGINS must be configured in production");
  }

  if (emailFeaturesEnabled) {
    if (!smtpHost) {
      throw new Error(
        "SMTP_HOST must be set in production when EMAIL_FEATURES_ENABLED=true",
      );
    }
    if (!Number.isInteger(smtpPort) || smtpPort <= 0) {
      throw new Error(
        "SMTP_PORT must be a positive integer in production when EMAIL_FEATURES_ENABLED=true",
      );
    }
    if (!smtpUser || !smtpPass) {
      throw new Error(
        "SMTP_USER and SMTP_PASS must be set in production when EMAIL_FEATURES_ENABLED=true",
      );
    }
    if (!smtpFrom) {
      throw new Error(
        "SMTP_FROM must be set in production when EMAIL_FEATURES_ENABLED=true",
      );
    }
    if (!baseUrl) {
      throw new Error(
        "BASE_URL must be set in production when EMAIL_FEATURES_ENABLED=true",
      );
    }
  }
}

if (nodeEnv === "test" || testDatabaseUrlEnvRaw !== undefined) {
  if (testDatabaseUrlEnvRaw !== undefined && !testDatabaseUrlFromAlias) {
    throw new Error("TEST_DATABASE_URL must be non-empty when provided");
  }

  const testDbUrlToValidate = testDatabaseUrlFromAlias || databaseUrlTestRaw;
  if (testDbUrlToValidate) {
    const isPostgresUrl = /^postgres(ql)?:\/\//i.test(testDbUrlToValidate);
    if (!isPostgresUrl) {
      throw new Error(
        "TEST_DATABASE_URL/DATABASE_URL_TEST must be a valid PostgreSQL URL",
      );
    }
  }
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv,
  databaseUrl,
  accessJwtSecret,
  refreshJwtSecret,
  corsOrigins,
  adminBootstrapSecret,
  emailFeaturesEnabled,
  smtpHost,
  smtpPort: Number.isInteger(smtpPort) && smtpPort > 0 ? smtpPort : 587,
  smtpUser,
  smtpPass,
  smtpFrom,
  baseUrl: baseUrl || "http://localhost:3000",
  aiProviderEnabled,
  aiProviderBaseUrl,
  aiProviderApiKey,
  aiProviderModel,
  allowLegacyPlaintextRefreshTokenFallback,
  legacyRefreshTokenFallbackUntil,
  aiDailySuggestionLimit:
    Number.isInteger(aiDailySuggestionLimit) && aiDailySuggestionLimit > 0
      ? aiDailySuggestionLimit
      : 50,
  aiDailySuggestionLimitByPlan: {
    free:
      Number.isInteger(aiDailySuggestionLimitFree) &&
      aiDailySuggestionLimitFree > 0
        ? aiDailySuggestionLimitFree
        : Number.isInteger(aiDailySuggestionLimit) && aiDailySuggestionLimit > 0
          ? aiDailySuggestionLimit
          : 50,
    pro:
      Number.isInteger(aiDailySuggestionLimitPro) &&
      aiDailySuggestionLimitPro > 0
        ? aiDailySuggestionLimitPro
        : 250,
    team:
      Number.isInteger(aiDailySuggestionLimitTeam) &&
      aiDailySuggestionLimitTeam > 0
        ? aiDailySuggestionLimitTeam
        : 1000,
  },
};
