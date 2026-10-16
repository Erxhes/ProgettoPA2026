import { Request, Response } from 'express';
import { ErrorFactory } from '../errors/ErrorFactory';
import { WeightRequestService } from '../services/WeightRequestService';
import { RequestsQuery } from '../validators/querySchemas';

/** Controller delle richieste di cambio peso: legge la richiesta e scrive la risposta HTTP. */
export class WeightRequestController {
  /** POST /models/:id/weight-requests */
  static async create(req: Request, res: Response): Promise<void> {
    const { from, to, newWeight } = req.body as { from: string; to: string; newWeight: number };
    const result = await WeightRequestService.create(
      WeightRequestController.userId(req),
      Number(req.params.id),
      from,
      to,
      newWeight,
    );
    res.status(201).json(result);
  }

  /** GET /weight-requests */
  static async list(req: Request, res: Response): Promise<void> {
    const filters = res.locals.query as RequestsQuery;
    const requests = await WeightRequestService.search(WeightRequestController.userId(req), filters);
    res.status(200).json({ count: requests.length, requests });
  }

  /** PATCH /weight-requests/:id/approve */
  static async approve(req: Request, res: Response): Promise<void> {
    res.status(200).json(await WeightRequestService.approve(WeightRequestController.userId(req), Number(req.params.id)));
  }

  /** PATCH /weight-requests/:id/reject */
  static async reject(req: Request, res: Response): Promise<void> {
    const { reason } = req.body as { reason: string };
    res.status(200).json(
      await WeightRequestService.reject(WeightRequestController.userId(req), Number(req.params.id), reason),
    );
  }

  /** Id dell'utente autenticato (impostato da authenticate). */
  private static userId(req: Request): number {
    if (!req.auth) throw ErrorFactory.unauthorized();
    return req.auth.userId;
  }
}
