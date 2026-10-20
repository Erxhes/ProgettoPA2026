import { RequestHandler } from 'express';
import { ErrorFactory } from '../errors/ErrorFactory';

/** Solleva un 404 per le rotte inesistenti */
export const notFound: RequestHandler = (_req, _res, next) => {
  next(ErrorFactory.notFound('Rotta non trovata'));
};
