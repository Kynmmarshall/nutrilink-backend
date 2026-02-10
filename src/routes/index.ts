import { Router } from 'express';

import adminRouter from './admin.js';
import authRouter from './auth.js';
import deliveriesRouter from './deliveries.js';
import listingsRouter from './listings.js';
import requestsRouter from './requests.js';
import usersRouter from './users.js';

export const router = Router();

router.use('/auth', authRouter);
router.use('/listings', listingsRouter);
router.use('/requests', requestsRouter);
router.use('/deliveries', deliveriesRouter);
router.use('/admin', adminRouter);
router.use('/users', usersRouter);
