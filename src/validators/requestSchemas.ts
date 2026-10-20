import { z } from 'zod';

/** Controlla arco e nuovo peso della richiesta */
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

/** Controlla la motivazione del rifiuto */
export const rejectWeightRequestSchema = z.object({
  reason: z.string().trim().min(1, 'la motivazione è obbligatoria').max(500),
});
