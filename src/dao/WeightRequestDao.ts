import { Op, Transaction, WhereOptions } from 'sequelize';
import { WeightChangeRequest } from '../models';
import { RequestStatus } from '../models/WeightChangeRequest';

export class WeightRequestDao {
  /** Crea una richiesta di cambio peso in stato "pending" */
  static create(data: {
    modelId: number;
    requesterId: number;
    fromNode: string;
    toNode: string;
    newWeight: number;
  }): Promise<WeightChangeRequest> {
    return WeightChangeRequest.create({ ...data, status: 'pending' });
  }

  /** Richieste inviate dall'utente o fatte sui suoi modelli, filtrate (in AND) per modello, giorno e stato */
  static search(filters: {
    requesterId: number;
    ownedModelIds: number[];
    modelId?: number;
    status?: RequestStatus;
    day?: { start: Date; end: Date };
  }): Promise<WeightChangeRequest[]> {
    const conditions: WhereOptions[] = [
      { [Op.or]: [{ requesterId: filters.requesterId }, { modelId: { [Op.in]: filters.ownedModelIds } }] },
    ];
    if (filters.modelId !== undefined) conditions.push({ modelId: filters.modelId });
    if (filters.status) conditions.push({ status: filters.status });
    if (filters.day) conditions.push({ createdAt: { [Op.gte]: filters.day.start, [Op.lt]: filters.day.end } });
    return WeightChangeRequest.findAll({
      where: { [Op.and]: conditions },
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  }

  /** Cerca una richiesta per id; con una transazione legge dentro di essa */
  static findById(id: number, tx?: Transaction): Promise<WeightChangeRequest | null> {
    return WeightChangeRequest.findByPk(id, tx ? { transaction: tx, lock: tx.LOCK.UPDATE } : {});
  }

  static save(request: WeightChangeRequest, tx?: Transaction): Promise<WeightChangeRequest> {
    return request.save({ transaction: tx });
  }
}
