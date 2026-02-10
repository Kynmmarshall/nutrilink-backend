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
  authorize('delivery'),
  asyncHandler(async (req, res) => {
    const deliveries = await prisma.delivery.findMany({
      where: { deliveryAgentId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { request: true },
    });

    res.json({ deliveries });
  }),
);

router.get(
  '/tasks/available',
  authenticate,
  authorize('delivery'),
  asyncHandler(async (_req, res) => {
    const requests = await prisma.request.findMany({
      where: {
        status: 'approved',
        delivery: null,
      },
      include: { listing: true, beneficiary: true },
      orderBy: { createdAt: 'asc' },
      take: 30,
    });

    res.json({ requests });
  }),
);

const acceptSchema = z.object({
  pickupAddress: z.string().min(3),
  dropoffAddress: z.string().min(3),
});

router.post(
  '/:requestId/accept',
  authenticate,
  authorize('delivery'),
  validateBody(acceptSchema),
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;

    const requestRecord = await prisma.request.findUnique({ where: { id: requestId } });
    if (!requestRecord || requestRecord.status !== 'approved') {
      throw new HttpError(400, 'Request is not available for delivery');
    }

    const existingDelivery = await prisma.delivery.findUnique({ where: { requestId } });
    if (existingDelivery) {
      throw new HttpError(409, 'Delivery already assigned');
    }

    const delivery = await prisma.delivery.create({
      data: {
        requestId,
        deliveryAgentId: req.user!.id,
        pickupAddress: req.body.pickupAddress,
        dropoffAddress: req.body.dropoffAddress,
        status: 'assigned',
      },
    });

    await prisma.request.update({
      where: { id: requestId },
      data: { status: 'in_progress' },
    });

    res.status(201).json({ delivery });
  }),
);

const updateDeliverySchema = z.object({
  status: z.enum(['assigned', 'picked_up', 'delivered', 'cancelled']),
  proofUrl: z.string().url().optional(),
});

router.patch(
  '/:id/status',
  authenticate,
  authorize('delivery'),
  validateBody(updateDeliverySchema),
  asyncHandler(async (req, res) => {
    const delivery = await prisma.delivery.findUnique({
      where: { id: req.params.id },
      include: { request: true },
    });

    if (!delivery || delivery.deliveryAgentId !== req.user!.id) {
      throw new HttpError(404, 'Delivery not found');
    }

    const data = req.body as z.infer<typeof updateDeliverySchema>;

    const updated = await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        status: data.status,
        proofUrl: data.proofUrl,
        pickupAt: data.status === 'picked_up' ? new Date() : delivery.pickupAt,
        deliveredAt: data.status === 'delivered' ? new Date() : delivery.deliveredAt,
      },
    });

    if (data.status === 'delivered') {
      await prisma.request.update({ where: { id: delivery.requestId }, data: { status: 'completed' } });
    }

    res.json({ delivery: updated });
  }),
);

export default router;
