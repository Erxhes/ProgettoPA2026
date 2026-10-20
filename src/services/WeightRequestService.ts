import { Database } from '../config/database';
import { env } from '../config/env';
import { EdgeInput, ModelDao } from '../dao/ModelDao';
import { WeightRequestDao } from '../dao/WeightRequestDao';
import { ErrorFactory } from '../errors/ErrorFactory';
import { WeightChangeRequest } from '../models';
import { round4 } from './graphUtils';
import { dayRange, RequestsQuery } from '../validators/querySchemas';

/** Rappresentazione pubblica di una richiesta di cambio peso. */
export interface WeightRequestView {
  id: number;
  modelId: number;
  requesterId: number;
  from: string;
  to: string;
  newWeight: number;
  status: string;
  rejectionReason: string | null;
  resultingVersionId: number | null;
  createdAt: Date;
  decidedAt: Date | null;
}

export interface ApproveResult {
  request: WeightRequestView;
  oldWeight: number;
  updatedWeight: number;
  versionNumber: number;
}

function toView(r: WeightChangeRequest): WeightRequestView {
  return {
    id: r.id,
    modelId: r.modelId,
    requesterId: r.requesterId,
    from: r.fromNode,
    to: r.toNode,
    newWeight: Number(r.newWeight),
    status: r.status,
    rejectionReason: r.rejectionReason,
    resultingVersionId: r.resultingVersionId,
    createdAt: r.createdAt,
    decidedAt: r.decidedAt,
  };
}

/**
 * Media esponenziale p = alpha * p_old + (1 - alpha) * p_new, arrotondata a 4 decimali
 * (precisione della colonna del peso).
 */
export function blendWeight(oldWeight: number, newWeight: number, alpha: number = env.alpha): number {
  return round4(alpha * oldWeight + (1 - alpha) * newWeight);
}

/** Logica di business delle richieste di cambio peso. */
export class WeightRequestService {
  /**
   * Crea una richiesta in stato "pending" per un arco della versione corrente del modello.
   * @throws NOT_FOUND se il modello o l'arco non esistono
   */
  static async create(
    userId: number,
    modelId: number,
    from: string,
    to: string,
    newWeight: number,
  ): Promise<WeightRequestView> {
    if (!(await ModelDao.findById(modelId))) throw ErrorFactory.notFound('Modello non trovato');
    const version = await ModelDao.findLatestVersion(modelId);
    if (!version || !version.edges.some((e) => e.fromNode === from && e.toNode === to)) {
      throw ErrorFactory.notFound(`Arco ${from}->${to} non presente nel modello`);
    }
    const request = await WeightRequestDao.create({ modelId, requesterId: userId, fromNode: from, toNode: to, newWeight });
    return toView(request);
  }

  /**
   * Elenca le richieste visibili all'utente (inviate da lui o sui suoi modelli) con filtri opzionali in AND.
   */
  static async search(userId: number, filters: RequestsQuery): Promise<WeightRequestView[]> {
    const ownedModelIds = await ModelDao.findIdsByOwner(userId);
    const found = await WeightRequestDao.search({
      requesterId: userId,
      ownedModelIds,
      modelId: filters.modelId,
      status: filters.status,
      day: filters.date ? dayRange(filters.date) : undefined,
    });
    return found.map(toView);
  }

  /**
   * Approva una richiesta (solo il proprietario del modello): aggiorna il peso con la media esponenziale
   * e crea una nuova versione dei pesi. Tutto in una transazione, con il modello bloccato.
   * @throws NOT_FOUND, FORBIDDEN se non è il proprietario, CONFLICT se la richiesta non è più pending
   */
  static async approve(userId: number, requestId: number): Promise<ApproveResult> {
    const pending = await WeightRequestDao.findById(requestId);
    if (!pending) throw ErrorFactory.notFound('Richiesta non trovata');

    return Database.getInstance().transaction(async (tx) => {
      const model = await ModelDao.lockById(pending.modelId, tx);
      if (!model) throw ErrorFactory.notFound('Modello non trovato');
      if (model.ownerId !== userId) throw ErrorFactory.forbidden('Solo il proprietario del modello può decidere');

      const request = await WeightRequestDao.findById(requestId, tx);
      if (!request) throw ErrorFactory.notFound('Richiesta non trovata');
      if (request.status !== 'pending') throw ErrorFactory.conflict('La richiesta è già stata decisa');

      const current = await ModelDao.findLatestVersion(model.id, tx);
      const target = current?.edges.find((e) => e.fromNode === request.fromNode && e.toNode === request.toNode);
      if (!current || !target) throw ErrorFactory.conflict('L\'arco della richiesta non esiste più nel modello');

      const oldWeight = Number(target.weight);
      const updatedWeight = blendWeight(oldWeight, Number(request.newWeight));
      const edges: EdgeInput[] = current.edges.map((e): EdgeInput => [
        e.fromNode,
        e.toNode,
        e === target ? updatedWeight : Number(e.weight),
      ]);
      const version = await ModelDao.addVersion(model.id, current.versionNumber + 1, current.nodeCount, edges, tx);

      request.status = 'approved';
      request.resultingVersionId = version.id;
      request.decidedAt = new Date();
      await WeightRequestDao.save(request, tx);

      return { request: toView(request), oldWeight, updatedWeight, versionNumber: version.versionNumber };
    });
  }

  /**
   * Rifiuta una richiesta con motivazione (solo il proprietario del modello).
   * @throws NOT_FOUND, FORBIDDEN se non è il proprietario, CONFLICT se la richiesta non è più pending
   */
  static async reject(userId: number, requestId: number, reason: string): Promise<WeightRequestView> {
    const pending = await WeightRequestDao.findById(requestId);
    if (!pending) throw ErrorFactory.notFound('Richiesta non trovata');
    const model = await ModelDao.findById(pending.modelId);
    if (!model) throw ErrorFactory.notFound('Modello non trovato');
    if (model.ownerId !== userId) throw ErrorFactory.forbidden('Solo il proprietario del modello può decidere');

    return Database.getInstance().transaction(async (tx) => {
      const request = await WeightRequestDao.findById(requestId, tx);
      if (!request) throw ErrorFactory.notFound('Richiesta non trovata');
      if (request.status !== 'pending') throw ErrorFactory.conflict('La richiesta è già stata decisa');
      request.status = 'rejected';
      request.rejectionReason = reason;
      request.decidedAt = new Date();
      await WeightRequestDao.save(request, tx);
      return toView(request);
    });
  }
}
