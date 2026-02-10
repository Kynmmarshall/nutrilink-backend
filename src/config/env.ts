import dotenv from 'dotenv';
import type { SignOptions } from 'jsonwebtoken';

dotenv.config();

const required = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

type JwtExpiry = SignOptions['expiresIn'];

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required(process.env.DATABASE_URL, 'DATABASE_URL'),
  adminAccessCode: required(process.env.ADMIN_ACCESS_CODE, 'ADMIN_ACCESS_CODE'),
  jwt: {
    accessSecret: required(process.env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET'),
    refreshSecret: required(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET'),
    accessTtl: (process.env.JWT_ACCESS_TTL ?? '15m') as JwtExpiry,
    refreshTtl: (process.env.JWT_REFRESH_TTL ?? '7d') as JwtExpiry,
  },
};
