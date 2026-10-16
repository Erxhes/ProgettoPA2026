import { RequestHandler } from 'express';
import { ErrorFactory } from '../errors/ErrorFactory';
import { Role } from '../models/User';

/** Consente l'accesso solo al ruolo indicato; altrimenti 403. Va dopo authenticate. */
export function requireRole(role: Role): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(ErrorFactory.unauthorized());
    } else if (req.auth.role !== role) {
      next(ErrorFactory.forbidden());
    } else {
      next();
    }
  };
}
