import { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorFactory } from '../errors/ErrorFactory';

/** Traduce gli errori di lettura del body (body-parser) in AppError; null per qualunque altro errore. */
function fromBodyParser(err: unknown): AppError | null {
  if (typeof err !== 'object' || err === null || !('type' in err)) return null;
  if (err.type === 'entity.parse.failed') return ErrorFactory.badRequest('Body JSON non valido');
  if (err.type === 'entity.too.large') return ErrorFactory.badRequest('Body della richiesta troppo grande');
  return null;
}

/** Error-handler centrale: traduce gli errori sollevati nei controller e nei middleware in risposte HTTP. */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const appError = err instanceof AppError ? err : fromBodyParser(err);
  if (appError) {
    res.status(appError.status).json({ error: { code: appError.code, message: appError.message } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Errore interno del server' } });
};
