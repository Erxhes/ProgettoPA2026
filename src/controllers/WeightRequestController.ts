import { Request, Response } from 'express';
import { ErrorFactory } from '../errors/ErrorFactory';
import { WeightRequestService } from '../services/WeightRequestService';
import { RequestsQuery } from '../validators/querySchemas';

export async function create(req: Request, res: Response): Promise<void> {
  const { from, to, newWeight } = req.body as { from: string; to: string; newWeight: number };
  const result = await WeightRequestService.create(
    userId(req),
    Number(req.params.id),
    from,
    to,
    newWeight,
  );
  res.status(201).json(result);
}

export async function list(req: Request, res: Response): Promise<void> {
  const filters = res.locals.query as RequestsQuery;
  const requests = await WeightRequestService.search(userId(req), filters);
  res.status(200).json({ count: requests.length, requests });
}

export async function approve(req: Request, res: Response): Promise<void> {
  res.status(200).json(await WeightRequestService.approve(userId(req), Number(req.params.id)));
}

export async function reject(req: Request, res: Response): Promise<void> {
  const { reason } = req.body as { reason: string };
  res.status(200).json(
    await WeightRequestService.reject(userId(req), Number(req.params.id), reason),
  );
}

/** Id dell'utente autenticato (impostato da authenticate) */
function userId(req: Request): number {
  if (!req.auth) throw ErrorFactory.unauthorized();
  return req.auth.userId;
}
