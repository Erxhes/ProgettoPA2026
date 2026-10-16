import { NextFunction, Request, RequestHandler, Response } from 'express';

/** Avvolge un handler asincrono: gli errori finiscono a next() e quindi nell'error-handler. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
