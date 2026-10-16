/**
 * Errore applicativo con status HTTP e codice stabile.
 * I controller e i middleware lo sollevano; l'error-handler centrale lo traduce in risposta.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
