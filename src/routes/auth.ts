import { Router } from 'express';
import { z } from 'zod';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { HttpError } from '../utils/httpError.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} from '../utils/token.js';
import { normalizeIncomingRole, toPublicUser } from '../utils/userSerializer.js';

const router = Router();

const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8),
  phoneNumber: z.string().min(7).max(32),
  role: z.enum(['provider', 'beneficiary', 'delivery', 'deliveryAgent', 'admin']),
  address: z.string().min(3).max(240).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  profileImage: z.string().url().optional(),
  adminAccessCode: z.string().optional(),
});

router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { fullName, email, password, role, phoneNumber, address, latitude, longitude, profileImage, adminAccessCode } =
      req.body as z.infer<typeof registerSchema>;

    const normalizedRole = normalizeIncomingRole(role);

    if (normalizedRole === 'admin') {
      if (!adminAccessCode || adminAccessCode !== env.adminAccessCode) {
        throw new HttpError(403, 'Invalid admin access code');
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new HttpError(409, 'Email already registered');
    }

    const passwordHash = await hashPassword(password);
    const status = normalizedRole === 'beneficiary' ? 'approved' : 'pending';

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: normalizedRole,
        status,
        phoneNumber,
        address,
        latitude,
        longitude,
        profileImage,
      },
    });

    const accessToken = createAccessToken({ sub: user.id, role: user.role });
    const refreshToken = createRefreshToken({ sub: user.id, role: user.role });

    res.status(201).json({
      user: toPublicUser(user),
      token: accessToken,
      refreshToken,
    });
  }),
);

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string(),
});

router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new HttpError(401, 'Invalid credentials');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new HttpError(401, 'Invalid credentials');
    }

    const accessToken = createAccessToken({ sub: user.id, role: user.role });
    const refreshToken = createRefreshToken({ sub: user.id, role: user.role });

    res.json({
      user: toPublicUser(user),
      token: accessToken,
      refreshToken,
    });
  }),
);

const refreshSchema = z.object({ refreshToken: z.string().min(10) });

router.post(
  '/refresh',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
    const payload = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new HttpError(401, 'User not found');
    }

    const accessToken = createAccessToken({ sub: user.id, role: user.role });
    const newRefreshToken = createRefreshToken({ sub: user.id, role: user.role });

    res.json({
      user: toPublicUser(user),
      token: accessToken,
      refreshToken: newRefreshToken,
    });
  }),
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    res.json({ user: toPublicUser(user) });
  }),
);

export default router;
