import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const insecureDefaultJwtSecret = 'your-secret-key-change-in-production';
const nodeEnv = process.env.NODE_ENV || 'development';
const accessJwtSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || insecureDefaultJwtSecret;
const refreshJwtSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || insecureDefaultJwtSecret;
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const adminBootstrapSecret = nodeEnv === 'test'
  ? (process.env.ADMIN_BOOTSTRAP_SECRET || 'test-admin-bootstrap-secret')
  : (process.env.ADMIN_BOOTSTRAP_SECRET || '').trim();

if (nodeEnv === 'production') {
  if (accessJwtSecret === insecureDefaultJwtSecret) {
    throw new Error('JWT_ACCESS_SECRET must be set to a strong non-default value in production');
  }

  if (refreshJwtSecret === insecureDefaultJwtSecret) {
    throw new Error('JWT_REFRESH_SECRET must be set to a strong non-default value in production');
  }

  if (accessJwtSecret === refreshJwtSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production');
  }

  if (corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must be configured in production');
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv,
  databaseUrl:
    nodeEnv === 'test'
      ? process.env.DATABASE_URL_TEST
      : process.env.DATABASE_URL,
  accessJwtSecret,
  refreshJwtSecret,
  corsOrigins,
  adminBootstrapSecret,
};
