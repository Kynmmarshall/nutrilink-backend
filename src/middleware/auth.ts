import type { NextFunction, Request, Response } from 'express';

import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/httpError.js';
import { verifyAccessToken } from '../utils/token.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export const authenticate = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing authorization token');
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, status: true },
  });

  if (!user) {
    throw new HttpError(401, 'User not found');
  }

  if (user.status !== 'approved') {
    throw new HttpError(403, 'User is not approved');
  }

  req.user = { id: user.id, role: user.role };
  next();
};

export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }

    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, 'Forbidden');
    }

    next();
  };
};
