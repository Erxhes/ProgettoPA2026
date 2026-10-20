import { z } from 'zod';

/** Numero massimo di passi di una simulazione */
export const MAX_STEPS = 1000;
/** Tolleranza per il confronto in virgola mobile nel conteggio dei passi (es. (1.3 - 1) / 0.1 = 2.9999999999999996) */
const EPSILON = 1e-9;

/** Numero con al massimo 4 decimali (precisione dei pesi) */
const decimal4 = z
  .number()
  .refine((n) => Math.abs(Math.round(n * 1e4) / 1e4 - n) < EPSILON, 'al massimo 4 decimali');

/** Numero di passi (peso iniziale incluso) da `initial` a `final` con passo `step` */
export function stepCount(initial: number, final: number, step: number): number {
  return Math.floor((final - initial) / step + EPSILON) + 1;
}

/** Controlla arco, pesi e passo della simulazione */
export const simulationSchema = z
  .object({
    start: z.string().min(1).max(50),
    goal: z.string().min(1).max(50),
    edge: z.object({ from: z.string().min(1).max(50), to: z.string().min(1).max(50) }),
    initialWeight: decimal4.pipe(z.number().positive('il peso iniziale deve essere maggiore di 0')),
    finalWeight: decimal4.pipe(z.number().lt(1_000_000, 'il peso finale deve essere minore di 1000000')),
    step: decimal4.pipe(z.number().positive('il passo deve essere maggiore di 0')),
  })
  .superRefine((s, ctx) => {
    if (s.initialWeight > s.finalWeight) {
      ctx.addIssue({ code: 'custom', path: ['finalWeight'], message: 'il peso finale deve essere >= del peso iniziale' });
      return;
    }
    if (s.step <= 0) return; // già segnalato dal controllo sul singolo campo
    if (s.step > s.finalWeight - s.initialWeight + EPSILON && s.finalWeight > s.initialWeight) {
      ctx.addIssue({ code: 'custom', path: ['step'], message: 'il passo non può essere maggiore dell\'intervallo tra peso iniziale e finale' });
    } else if (stepCount(s.initialWeight, s.finalWeight, s.step) > MAX_STEPS) {
      ctx.addIssue({ code: 'custom', path: ['step'], message: `la simulazione non può superare ${MAX_STEPS} passi` });
    }
  });

export type SimulationInput = z.infer<typeof simulationSchema>;
