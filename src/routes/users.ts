import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { HttpError } from '../utils/httpError.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { normalizeIncomingRole, toPublicUser } from '../utils/userSerializer.js';

const router = Router();

const roleEnum = ['provider', 'beneficiary', 'delivery', 'deliveryAgent', 'admin'] as const;

type RoleValue = (typeof roleEnum)[number];

const listUsersQuerySchema = z.object({
  role: z.enum(roleEnum).optional(),
  includePending: z.coerce.boolean().default(false),
  activeOnly: z.coerce.boolean().default(true),
  search: z.string().min(2).optional(),
  take: z.coerce.number().min(1).max(200).default(100),
});

router.get(
  '/',
  authenticate,
  validateQuery(listUsersQuerySchema),
  asyncHandler(async (req, res) => {
    const { role, includePending, activeOnly, search, take } = listUsersQuerySchema.parse(req.query);

    const where: Prisma.UserWhereInput = {};

    if (!includePending) {
      where.status = 'approved';
    }

    if (activeOnly) {
      where.isActive = true;
    }

    if (role) {
      where.role = normalizeIncomingRole(role);
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });

    res.json({ users: users.map(toPublicUser) });
  }),
);

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phoneNumber: z.string().min(7).max(32).optional(),
  address: z.string().min(3).max(240).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  profileImage: z.string().url().optional().nullable(),
  locale: z.string().min(2).max(5).optional(),
  role: z.enum(roleEnum).optional(),
  status: z.enum(['pending', 'approved', 'suspended']).optional(),
  isActive: z.boolean().optional(),
});

router.put(
  '/:id',
  authenticate,
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const payload = req.body as z.infer<typeof updateUserSchema>;

    if (Object.keys(payload).length === 0) {
      throw new HttpError(400, 'No updates provided');
    }

    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }

    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.id === userId;

    if (!isSelf && !isAdmin) {
      throw new HttpError(403, 'You can only update your own profile');
    }

    const wantsAdminOnlyFields =
      payload.role !== undefined || payload.status !== undefined || payload.isActive !== undefined;

    if (wantsAdminOnlyFields && !isAdmin) {
      throw new HttpError(403, 'Only admins can update role, status, or activity');
    }

    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      throw new HttpError(404, 'User not found');
    }

    const data: Parameters<typeof prisma.user.update>[0]['data'] = {};

    if (payload.fullName !== undefined) data.fullName = payload.fullName;
    if (payload.phoneNumber !== undefined) data.phoneNumber = payload.phoneNumber;
    if (payload.address !== undefined) data.address = payload.address;
    if (payload.latitude !== undefined) data.latitude = payload.latitude;
    if (payload.longitude !== undefined) data.longitude = payload.longitude;
    if (payload.profileImage !== undefined) data.profileImage = payload.profileImage;
    if (payload.locale !== undefined) data.locale = payload.locale;
    if (payload.isActive !== undefined) data.isActive = payload.isActive;
    if (payload.status !== undefined) data.status = payload.status;
    if (payload.role !== undefined) {
      data.role = normalizeIncomingRole(payload.role as RoleValue);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
    });

    res.json({ user: toPublicUser(updatedUser) });
  }),
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

router.post(
  '/:id/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;

    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }

    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.id === userId;

    if (!isSelf && !isAdmin) {
      throw new HttpError(403, 'You can only change your own password');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    if (!isAdmin) {
      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        throw new HttpError(401, 'Current password is incorrect');
      }
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    res.json({ message: 'Password updated successfully' });
  }),
);

export default router;
