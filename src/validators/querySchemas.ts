import { z } from 'zod';

/** Intero non negativo passato come stringa nella query (solo cifre, senza segno). */
const nonNegativeInt = z
  .string()
  .regex(/^\d+$/, 'deve essere un numero intero senza segno')
  .transform(Number)
  .refine(Number.isSafeInteger, 'valore troppo grande');

/** Intero positivo passato come stringa nella query. */
const positiveInt = nonNegativeInt.refine((n) => n > 0, 'deve essere maggiore di 0');

/** Giorno nel formato YYYY-MM-DD, con controllo di calendario (es. 2026-02-30 non è valido). */
const dayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'formato richiesto YYYY-MM-DD')
  // pipe: il controllo di calendario gira solo se la regex è passata
  .pipe(z.string().refine((d) => {
    const parsed = new Date(`${d}T00:00:00Z`);
    // l'anno 0000 non è rappresentabile in Postgres: va rifiutato qui, altrimenti la query fallisce con 500
    return !d.startsWith('0000') && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d;
  }, 'data non valida'));

/** Filtri di GET /weight-requests (tutti opzionali, combinati in AND; parametri sconosciuti rifiutati). */
export const requestsQuerySchema = z
  .object({
    modelId: positiveInt.optional(),
    date: dayString.optional(),
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
  })
  .strict();

/** Filtri di GET /models/:id/versions (tutti opzionali). */
export const versionsQuerySchema = z
  .object({
    date: dayString.optional(),
    nodes: nonNegativeInt.optional(),
    edges: nonNegativeInt.optional(),
  })
  .strict();

export type RequestsQuery = z.infer<typeof requestsQuerySchema>;
export type VersionsQuery = z.infer<typeof versionsQuerySchema>;

/** Intervallo [start, end) che copre l'intero giorno UTC indicato. */
export function dayRange(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00Z`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
