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
const databaseUrl =
  nodeEnv === "test" ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
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
};
