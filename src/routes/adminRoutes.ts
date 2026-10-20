import { Router } from 'express';
import { z } from 'zod';
import * as AdminController from '../controllers/AdminController';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireRole } from '../middleware/requireRole';
import { validateBody } from '../middleware/validate';

const rechargeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  // Il saldo ha 2 decimali: con di più verrebbe arrotondato senza avvisare
  credit: z
    .number()
    .positive()
    .max(1_000_000)
    .refine((v) => Number(v.toFixed(2)) === v, 'al massimo 2 decimali'),
});

/** Rotte riservate al ruolo admin (authenticate e checkTokens sono applicati a monte) */
export const adminRoutes = Router();
adminRoutes.post('/recharge', requireRole('admin'), validateBody(rechargeSchema), asyncHandler(AdminController.recharge));
