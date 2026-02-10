import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

export type JwtPayload = {
  sub: string;
  role: string;
};

export const createAccessToken = (payload: JwtPayload): string =>
  jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl });

export const createRefreshToken = (payload: JwtPayload): string =>
  jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshTtl });

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.jwt.accessSecret) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.jwt.refreshSecret) as JwtPayload;
};
