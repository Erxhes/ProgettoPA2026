import { Op, Transaction, WhereOptions } from 'sequelize';
import { Edge, GraphModel, ModelVersion } from '../models';

/** Arco da salvare: [da, a, peso] */
export type EdgeInput = [string, string, number];

/** Versione di un modello con i suoi archi */
export type VersionWithEdges = ModelVersion & { edges: Edge[] };

/** Query su modelli, versioni e archi */
export class ModelDao {
  /** Crea il modello con la versione 1 e i suoi archi */
  static async createWithFirstVersion(
    ownerId: number,
    name: string,
    nodeCount: number,
    edges: EdgeInput[],
    tx: Transaction,
  ): Promise<{ model: GraphModel; version: ModelVersion }> {
    const model = await GraphModel.create({ name, ownerId }, { transaction: tx });
    const version = await ModelDao.addVersion(model.id, 1, nodeCount, edges, tx);
    return { model, version };
  }

  /** Aggiunge una versione con i suoi archi */
  static async addVersion(
    modelId: number,
    versionNumber: number,
    nodeCount: number,
    edges: EdgeInput[],
    tx: Transaction,
  ): Promise<ModelVersion> {
    const version = await ModelVersion.create(
      { modelId, versionNumber, nodeCount, edgeCount: edges.length },
      { transaction: tx },
    );
    await Edge.bulkCreate(
      edges.map(([fromNode, toNode, weight]) => ({ versionId: version.id, fromNode, toNode, weight })),
      { transaction: tx },
    );
    return version;
  }

  /** Cerca un modello per id */
  static findById(id: number): Promise<GraphModel | null> {
    return GraphModel.findByPk(id);
  }

  /** Id dei modelli di un proprietario */
  static async findIdsByOwner(ownerId: number): Promise<number[]> {
    const owned = await GraphModel.findAll({ where: { ownerId }, attributes: ['id'] });
    return owned.map((m) => m.id);
  }

  /** Versioni di un modello con i loro archi, filtrate (in AND) per giorno, nodi e archi */
  static listVersions(
    modelId: number,
    filters: { day?: { start: Date; end: Date }; nodes?: number; edges?: number },
  ): Promise<VersionWithEdges[]> {
    // parto dal modello e aggiungo i filtri solo se ci sono
    const where: WhereOptions = { modelId };
    const conditions: WhereOptions[] = [where];
    if (filters.day) conditions.push({ createdAt: { [Op.gte]: filters.day.start, [Op.lt]: filters.day.end } });
    if (filters.nodes !== undefined) conditions.push({ nodeCount: filters.nodes });
    if (filters.edges !== undefined) conditions.push({ edgeCount: filters.edges });
    return ModelVersion.findAll({
      where: { [Op.and]: conditions },
      include: [{ model: Edge, as: 'edges' }],
      order: [
        ['versionNumber', 'ASC'],
        [{ model: Edge, as: 'edges' }, 'id', 'ASC'],
      ],
    }) as Promise<VersionWithEdges[]>;
  }

  /** Legge il modello bloccandone la riga (FOR UPDATE), così le approvazioni concorrenti vanno una alla volta */
  static lockById(id: number, tx: Transaction): Promise<GraphModel | null> {
    return GraphModel.findByPk(id, { transaction: tx, lock: tx.LOCK.UPDATE });
  }

  /** Versione più recente di un modello, con i suoi archi */
  static findLatestVersion(modelId: number, tx?: Transaction): Promise<VersionWithEdges | null> {
    return ModelVersion.findOne({
      where: { modelId },
      order: [['versionNumber', 'DESC']],
      include: [{ model: Edge, as: 'edges' }],
      transaction: tx,
    }) as Promise<VersionWithEdges | null>;
  }
}
