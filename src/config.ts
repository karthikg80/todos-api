import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const insecureDefaultJwtSecret = 'your-secret-key-change-in-production';
const nodeEnv = process.env.NODE_ENV || 'development';
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

if (nodeEnv === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === insecureDefaultJwtSecret) {
    throw new Error('JWT_SECRET must be set to a strong non-default value in production');
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
  jwtSecret: process.env.JWT_SECRET || insecureDefaultJwtSecret,
  corsOrigins,
};
