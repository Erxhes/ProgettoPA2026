import { Request, Response } from 'express';
import { ErrorFactory } from '../errors/ErrorFactory';
import { ModelService } from '../services/ModelService';
import { GraphInput } from '../validators/modelSchemas';

/** Controller delle rotte sui modelli: legge la richiesta e scrive la risposta HTTP. */
export class ModelController {
  /** POST /models */
  static async create(req: Request, res: Response): Promise<void> {
    const { name, graph } = req.body as { name: string; graph: GraphInput };
    res.status(201).json(await ModelService.create(ModelController.userId(req), name, graph));
  }

  /** POST /models/:id/execute */
  static async execute(req: Request, res: Response): Promise<void> {
    const { start, goal } = req.body as { start: string; goal: string };
    const result = await ModelService.execute(ModelController.userId(req), Number(req.params.id), start, goal);
    res.status(200).json(result);
  }

  /** Id dell'utente autenticato (impostato da authenticate). */
  private static userId(req: Request): number {
    if (!req.auth) throw ErrorFactory.unauthorized();
    return req.auth.userId;
  }
}
