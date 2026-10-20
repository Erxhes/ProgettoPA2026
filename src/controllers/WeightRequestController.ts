import { Request, Response } from 'express';
import { WeightRequestService } from '../services/WeightRequestService';
import { RequestsQuery } from '../validators/querySchemas';

/** Crea una richiesta di cambio peso su un arco del modello */
export async function create(req: Request, res: Response): Promise<void> {
  const { from, to, newWeight } = req.body as { from: string; to: string; newWeight: number };
  const result = await WeightRequestService.create(
    req.auth.userId,
    Number(req.params.id),
    from,
    to,
    newWeight,
  );
  res.status(201).json(result);
}

/** Elenca le richieste dell'utente con i filtri */
export async function list(req: Request, res: Response): Promise<void> {
  const filters = res.locals.query as RequestsQuery;
  const requests = await WeightRequestService.search(req.auth.userId, filters);
  res.status(200).json({ count: requests.length, requests });
}

/** Il proprietario approva la richiesta */
export async function approve(req: Request, res: Response): Promise<void> {
  res.status(200).json(await WeightRequestService.approve(req.auth.userId, Number(req.params.id)));
}

/** Il proprietario rifiuta la richiesta con una motivazione */
export async function reject(req: Request, res: Response): Promise<void> {
  const { reason } = req.body as { reason: string };
  res.status(200).json(
    await WeightRequestService.reject(req.auth.userId, Number(req.params.id), reason),
  );
}
