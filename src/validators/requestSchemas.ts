import { z } from 'zod';

/** Corpo di POST /models/:id/weight-requests. */
export const createWeightRequestSchema = z.object({
  from: z.string().min(1).max(50),
  to: z.string().min(1).max(50),
  newWeight: z
    .number()
    .finite()
    .positive('il peso deve essere maggiore di 0')
    .lt(1_000_000)
    .refine((w) => Math.round(w * 1e4) / 1e4 === w, 'al massimo 4 decimali'),
});

/** Corpo di PATCH /weight-requests/:id/reject: la motivazione è obbligatoria. */
export const rejectWeightRequestSchema = z.object({
  reason: z.string().trim().min(1, 'la motivazione è obbligatoria').max(500),
});
