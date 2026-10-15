/** Valore di alpha usato quando quello in env è assente o non valido. */
export const DEFAULT_ALPHA = 0.9;

/**
 * Ricava il coefficiente alpha della media esponenziale dalla variabile d'ambiente.
 * Valido solo se 0 < alpha < 1; altrimenti si usa 0.9 (con un avviso se il valore era presente ma errato).
 * @param raw valore grezzo di ALPHA
 */
export function resolveAlpha(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_ALPHA;
  const alpha = Number(raw);
  if (Number.isFinite(alpha) && alpha > 0 && alpha < 1) return alpha;
  console.warn(`ALPHA="${raw}" non valido (deve essere > 0 e < 1): uso il valore di default ${DEFAULT_ALPHA}`);
  return DEFAULT_ALPHA;
}
