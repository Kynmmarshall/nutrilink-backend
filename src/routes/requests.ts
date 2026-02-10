import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize('beneficiary', 'provider', 'delivery', 'admin'),
  asyncHandler(async (req, res) => {
    const role = req.user!.role;
    const userId = req.user!.id;

    let requests;
    if (role === 'beneficiary') {
      requests = await prisma.request.findMany({
        where: { beneficiaryId: userId },
        orderBy: { createdAt: 'desc' },
        include: { listing: true },
      });
    } else if (role === 'provider') {
      requests = await prisma.request.findMany({
        where: { listing: { providerId: userId } },
        orderBy: { createdAt: 'desc' },
        include: { beneficiary: true, listing: true },
      });
    } else if (role === 'delivery') {
      requests = await prisma.request.findMany({
        where: { delivery: { deliveryAgentId: userId } },
        include: { delivery: true, listing: true, beneficiary: true },
      });
    } else {
      requests = await prisma.request.findMany({
        orderBy: { createdAt: 'desc' },
        include: { beneficiary: true, listing: true },
      });
    }

    res.json({ requests });
  }),
);

const createRequestSchema = z.object({
  listingId: z.string().uuid(),
  requestedServings: z.number().int().min(1),
  notes: z.string().max(500).optional(),
});

router.post(
  '/',
  authenticate,
  authorize('beneficiary'),
  validateBody(createRequestSchema),
  asyncHandler(async (req, res) => {
    const { listingId, requestedServings, notes } = req.body as z.infer<typeof createRequestSchema>;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== 'available') {
      throw new HttpError(404, 'Listing not available');
    }

    if (listing.servingsLeft < requestedServings) {
      throw new HttpError(400, 'Not enough servings remaining');
    }

    const [request] = await prisma.$transaction([
      prisma.request.create({
        data: {
          listingId,
          beneficiaryId: req.user!.id,
          requestedServings,
          notes,
        },
      }),
      prisma.listing.update({
        where: { id: listingId },
        data: { servingsLeft: listing.servingsLeft - requestedServings },
      }),
    ]);

    res.status(201).json({ request });
  }),
);

const updateRequestSchema = z.object({
  status: z.enum(['pending', 'approved', 'in_progress', 'completed', 'cancelled']),
});

router.patch(
  '/:id/status',
  authenticate,
  authorize('beneficiary', 'provider', 'delivery', 'admin'),
  validateBody(updateRequestSchema),
  asyncHandler(async (req, res) => {
    const { status } = req.body as z.infer<typeof updateRequestSchema>;

    const requestRecord = await prisma.request.findUnique({
      where: { id: req.params.id },
      include: { listing: true },
    });

    if (!requestRecord) {
      throw new HttpError(404, 'Request not found');
    }

    const role = req.user!.role;
    const isOwner = requestRecord.beneficiaryId === req.user!.id;
    const isProvider = requestRecord.listing.providerId === req.user!.id;

    if (role === 'beneficiary' && status !== 'cancelled') {
      throw new HttpError(403, 'Beneficiaries can only cancel requests');
    }

    if (role === 'beneficiary' && !isOwner) {
      throw new HttpError(403, 'Cannot modify another beneficiary request');
    }

    if (role === 'provider' && !isProvider) {
      throw new HttpError(403, 'Cannot modify another provider request');
    }

    if (role === 'delivery' || role === 'admin') {
      // allowed
    } else if (!['beneficiary', 'provider'].includes(role)) {
      throw new HttpError(403, 'Forbidden');
    }

    const listing = requestRecord.listing;

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const updated = await tx.request.update({
        where: { id: requestRecord.id },
        data: { status },
      });

      if (status === 'cancelled' && requestRecord.status !== 'cancelled') {
        await tx.listing.update({
          where: { id: listing.id },
          data: { servingsLeft: { increment: requestRecord.requestedServings } },
        });
      }

      if (status === 'completed') {
        await tx.listing.update({
          where: { id: listing.id },
          data: { status: listing.servingsLeft === 0 ? 'completed' : listing.status },
        });
      }

      return updated;
    });

    res.json({ request: updatedRequest });
  }),
);

export default router;
