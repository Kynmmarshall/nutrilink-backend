import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env.js';

export type JwtPayload = {
  sub: string;
  role: string;
};

const accessSecret: Secret = env.jwt.accessSecret;
const refreshSecret: Secret = env.jwt.refreshSecret;
const accessOptions: SignOptions = { expiresIn: env.jwt.accessTtl };
const refreshOptions: SignOptions = { expiresIn: env.jwt.refreshTtl };

export const createAccessToken = (payload: JwtPayload): string =>
  jwt.sign(payload, accessSecret, accessOptions);

export const createRefreshToken = (payload: JwtPayload): string =>
  jwt.sign(payload, refreshSecret, refreshOptions);

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, accessSecret) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, refreshSecret) as JwtPayload;
};
