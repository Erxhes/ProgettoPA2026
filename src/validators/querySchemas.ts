import { z } from 'zod';

/** Intero non negativo passato come stringa nella query */
const nonNegativeInt = z
  .string()
  .regex(/^\d+$/, 'deve essere un numero intero senza segno')
  .transform(Number)
  .refine(Number.isSafeInteger, 'valore troppo grande');

const positiveInt = nonNegativeInt.refine((n) => n > 0, 'deve essere maggiore di 0');

/** Giorno nel formato YYYY-MM-DD, con controllo di calendario (2026-02-30 non è valido) */
const dayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'formato richiesto YYYY-MM-DD')
  .refine((d) => new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d, 'data non valida');

/** Filtri di GET /weight-requests (tutti opzionali, combinati in AND) */
export const requestsQuerySchema = z.object({
  modelId: positiveInt.optional(),
  date: dayString.optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

/** Filtri di GET /models/:id/versions (tutti opzionali) */
export const versionsQuerySchema = z.object({
  date: dayString.optional(),
  nodes: nonNegativeInt.optional(),
  edges: nonNegativeInt.optional(),
});

export type RequestsQuery = z.infer<typeof requestsQuerySchema>;
export type VersionsQuery = z.infer<typeof versionsQuerySchema>;

/** Intervallo [start, end) che copre l'intero giorno UTC indicato */
export function dayRange(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00Z`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
