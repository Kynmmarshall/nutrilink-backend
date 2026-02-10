import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

const listQuerySchema = z.object({
  status: z.enum(['available', 'reserved', 'completed', 'expired']).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  take: z.coerce.number().min(1).max(100).default(20),
});

router.get(
  '/',
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const { status, category, search, take } = listQuerySchema.parse(req.query);

    const listings = await prisma.listing.findMany({
      where: {
        status,
        category: category?.toLowerCase(),
        OR: search
          ? [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        provider: {
          select: { id: true, fullName: true },
        },
      },
    });

    res.json({ listings });
  }),
);

router.get(
  '/mine',
  authenticate,
  authorize('provider'),
  asyncHandler(async (req, res) => {
    const listings = await prisma.listing.findMany({
      where: { providerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ listings });
  }),
);

const createListingSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(2000).optional(),
  category: z.string().min(2),
  foodType: z.string().min(2),
  servingsTotal: z.number().int().min(1),
  expiryAt: z.coerce.date(),
  address: z.string().min(3),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

router.post(
  '/',
  authenticate,
  authorize('provider'),
  validateBody(createListingSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof createListingSchema>;

    const listing = await prisma.listing.create({
      data: {
        providerId: req.user!.id,
        title: data.title,
        description: data.description,
        category: data.category.toLowerCase(),
        foodType: data.foodType.toLowerCase(),
        servingsTotal: data.servingsTotal,
        servingsLeft: data.servingsTotal,
        expiryAt: data.expiryAt,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    res.status(201).json({ listing });
  }),
);

const updateListingSchema = createListingSchema.partial().extend({
  status: z.enum(['available', 'reserved', 'completed', 'expired']).optional(),
  servingsLeft: z.number().int().min(0).optional(),
});

router.patch(
  '/:id',
  authenticate,
  authorize('provider'),
  validateBody(updateListingSchema),
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing || listing.providerId !== req.user!.id) {
      throw new HttpError(404, 'Listing not found');
    }

    const data = req.body as z.infer<typeof updateListingSchema>;
    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category?.toLowerCase(),
        foodType: data.foodType?.toLowerCase(),
        servingsTotal: data.servingsTotal,
        servingsLeft: data.servingsLeft,
        expiryAt: data.expiryAt,
        status: data.status,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    res.json({ listing: updated });
  }),
);

export default router;
