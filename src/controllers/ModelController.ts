import { Request, Response } from 'express';
import { ErrorFactory } from '../errors/ErrorFactory';
import { ModelService } from '../services/ModelService';
import { SimulationService } from '../services/SimulationService';
import { VersionService } from '../services/VersionService';
import { SimulationInput } from '../validators/simulationSchemas';
import { VersionsQuery } from '../validators/querySchemas';
import { GraphInput } from '../validators/modelSchemas';

// Controller delle rotte sui modelli: legge la richiesta e scrive la risposta HTTP.

/** POST /models */
export async function create(req: Request, res: Response): Promise<void> {
  const { name, graph } = req.body as { name: string; graph: GraphInput };
  res.status(201).json(await ModelService.create(userId(req), name, graph));
}

/** POST /models/:id/execute */
export async function execute(req: Request, res: Response): Promise<void> {
  const { start, goal } = req.body as { start: string; goal: string };
  const result = await ModelService.execute(userId(req), Number(req.params.id), start, goal);
  res.status(200).json(result);
}

/** POST /models/:id/simulate */
export async function simulate(req: Request, res: Response): Promise<void> {
  res.status(200).json(await SimulationService.simulate(Number(req.params.id), req.body as SimulationInput));
}

/** GET /models/:id/versions */
export async function versions(req: Request, res: Response): Promise<void> {
  const modelId = Number(req.params.id);
  const list = await VersionService.list(modelId, res.locals.query as VersionsQuery);
  res.status(200).json({ modelId, count: list.length, versions: list });
}

/** Id dell'utente autenticato (impostato da authenticate). */
function userId(req: Request): number {
  if (!req.auth) throw ErrorFactory.unauthorized();
  return req.auth.userId;
}
