/** Valore di alpha usato quando quello in env è assente o non valido */
export const DEFAULT_ALPHA = 0.9;

/** Ricava alpha (media esponenziale) dalla variabile d'ambiente ALPHA */
export function resolveAlpha(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_ALPHA;
  const alpha = Number(raw);
  if (alpha > 0 && alpha < 1) return alpha;
  console.warn(`ALPHA="${raw}" non valido (serve 0 < alpha < 1), uso ${DEFAULT_ALPHA}`);
  return DEFAULT_ALPHA;
}
