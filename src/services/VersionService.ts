import { ModelDao } from '../dao/ModelDao';
import { ErrorFactory } from '../errors/ErrorFactory';
import { dayRange, VersionsQuery } from '../validators/querySchemas';

/** Versione dei pesi di un modello, con i pesi di tutti gli archi */
export interface VersionView {
  versionNumber: number;
  nodeCount: number;
  edgeCount: number;
  /** Data di modifica (creazione della versione) */
  modifiedAt: Date;
  edges: { from: string; to: string; weight: number }[];
}

/** Consultazione delle versioni dei pesi */
export class VersionService {
  /** Elenca le versioni di un modello con filtri opzionali in AND (giorno di modifica, nodi, archi) */
  static async list(modelId: number, filters: VersionsQuery): Promise<VersionView[]> {
    if (!(await ModelDao.findById(modelId))) throw ErrorFactory.notFound('Modello non trovato');
    const versions = await ModelDao.listVersions(modelId, {
      day: filters.date ? dayRange(filters.date) : undefined,
      nodes: filters.nodes,
      edges: filters.edges,
    });
    return versions.map((v) => ({
      versionNumber: v.versionNumber,
      nodeCount: v.nodeCount,
      edgeCount: v.edgeCount,
      modifiedAt: v.createdAt,
      edges: v.edges.map((e) => ({ from: e.fromNode, to: e.toNode, weight: Number(e.weight) })),
    }));
  }
}
