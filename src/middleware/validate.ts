import { RequestHandler } from 'express';
import { z, ZodType } from 'zod';
import { ErrorFactory } from '../errors/ErrorFactory';

// Messaggi di errore di zod in italiano, come il resto delle risposte dell'API
z.config(z.locales.it());

/** Valida un valore con uno schema zod; restituisce il dato tipizzato o solleva 400 */
function parse(schema: ZodType, value: unknown): unknown {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.') || 'richiesta'}: ${i.message}`).join('; ');
    throw ErrorFactory.badRequest(details);
  }
  return result.data;
}

/** Valida il body con uno schema zod, altrimenti 400 */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    try {
      req.body = parse(schema, req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Valida la query string; con Express 5 il risultato va in res.locals.query perché req.query non si può riassegnare */
export function validateQuery(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    try {
      res.locals.query = parse(schema, req.query);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Valida i parametri della rotta, altrimenti 400 */
export function validateParams(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    try {
      parse(schema, req.params);
      next();
    } catch (err) {
      next(err);
    }
  };
}
