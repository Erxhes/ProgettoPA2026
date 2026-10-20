import { RequestHandler } from 'express';
import { ErrorFactory } from '../errors/ErrorFactory';
import { Role } from '../models/User';

/** Consente l'accesso solo al ruolo indicato, altrimenti 403 (va dopo authenticate) */
export function requireRole(role: Role): RequestHandler {
  return (req, _res, next) => {
    next(req.auth.role === role ? undefined : ErrorFactory.forbidden());
  };
}
