import { Router } from 'express';
import { z } from 'zod';
import { AdminController } from '../controllers/AdminController';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireRole } from '../middleware/requireRole';
import { validateBody } from '../middleware/validate';

const rechargeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  // Il saldo è DECIMAL(10,2): oltre i 2 decimali il credito verrebbe arrotondato in silenzio.
  // toFixed(2) è esatto per i valori scritti con 2 decimali (19.99, 0.07), a differenza di x * 100.
  credit: z
    .number()
    .positive()
    .max(1_000_000)
    .refine((v) => Number(v.toFixed(2)) === v, 'al massimo 2 decimali'),
});

/** Rotte riservate al ruolo admin (authenticate e checkTokens sono applicati a monte). */
export const adminRoutes = Router();
adminRoutes.post('/recharge', requireRole('admin'), validateBody(rechargeSchema), asyncHandler(AdminController.recharge));
