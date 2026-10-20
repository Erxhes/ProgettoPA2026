import { RequestHandler } from 'express';
import { ErrorFactory } from '../errors/ErrorFactory';
import { JwtService } from '../services/JwtService';

/** Verifica il JWT Bearer e imposta req.auth; senza token valido solleva 401 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(ErrorFactory.unauthorized('Token JWT mancante'));
    return;
  }
  try {
    req.auth = JwtService.verify(header.slice('Bearer '.length));
    next();
  } catch {
    next(ErrorFactory.unauthorized('Token JWT non valido o scaduto'));
  }
};
