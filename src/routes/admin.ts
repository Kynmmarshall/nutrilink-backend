import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get(
  '/analytics/summary',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req, res) => {
    const [usersCount, listingsCount, completedRequests, activeDeliveries] = await Promise.all([
      prisma.user.count(),
      prisma.listing.count(),
      prisma.request.count({ where: { status: 'completed' } }),
      prisma.delivery.count({ where: { status: { in: ['assigned', 'picked_up'] } } }),
    ]);

    const mealsAvailableAggregate = await prisma.listing.aggregate({
      _sum: { servingsLeft: true },
    });

    const mealsDelivered = await prisma.request.aggregate({
      _sum: { requestedServings: true },
      where: { status: 'completed' },
    });

    res.json({
      summary: {
        totalUsers: usersCount,
        totalListings: listingsCount,
        mealsDelivered: mealsDelivered._sum.requestedServings ?? 0,
        mealsAvailable: mealsAvailableAggregate._sum.servingsLeft ?? 0,
        activeDeliveries,
        completedRequests,
      },
    });
  }),
);

export default router;
