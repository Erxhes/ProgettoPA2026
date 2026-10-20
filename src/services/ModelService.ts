import Graph from 'node-dijkstra';
import { Database } from '../config/database';
import { EdgeInput, ModelDao } from '../dao/ModelDao';
import { ErrorFactory } from '../errors/ErrorFactory';
import { graphStats, GraphInput } from '../validators/modelSchemas';
import { buildAdjacency, round4 } from './graphUtils';
import { TokenService } from './TokenService';

export interface CreateModelResult {
  id: number;
  name: string;
  versionNumber: number;
  nodes: number;
  edges: number;
  tokensCharged: number;
  remainingTokens: number;
}

export interface ExecuteModelResult {
  modelId: number;
  versionNumber: number;
  start: string;
  goal: string;
  /** Percorso ottimo, o null se goal non è raggiungibile da start */
  path: string[] | null;
  /** Somma dei pesi lungo il percorso (non i token), null se non c'è percorso */
  cost: number | null;
  executionTimeMs: number;
  tokensCharged: number;
  remainingTokens: number;
}

/** Logica di business di creazione ed esecuzione dei modelli */
export class ModelService {
  /** Crea un modello (versione 1) addebitando 0.20 per nodo + 0.01 per arco */
  static async create(userId: number, name: string, graph: GraphInput): Promise<CreateModelResult> {
    const { nodes, edges } = graphStats(graph);
    const cost = TokenService.costFor(nodes, edges);
    const edgeList: EdgeInput[] = Object.entries(graph).flatMap(([from, neighbors]) =>
      Object.entries(neighbors).map(([to, weight]): EdgeInput => [from, to, weight]),
    );

    return Database.getInstance().transaction(async (tx) => {
      const remainingTokens = await TokenService.charge(userId, cost, tx);
      const { model, version } = await ModelDao.createWithFirstVersion(userId, name, nodes, edgeList, tx);
      return {
        id: model.id,
        name: model.name,
        versionNumber: version.versionNumber,
        nodes,
        edges,
        tokensCharged: cost,
        remainingTokens,
      };
    });
  }

  /** Calcola il percorso minimo con node-dijkstra e addebita lo stesso costo della creazione */
  static async execute(userId: number, modelId: number, start: string, goal: string): Promise<ExecuteModelResult> {
    if (!(await ModelDao.findById(modelId))) throw ErrorFactory.notFound('Modello non trovato');
    const version = await ModelDao.findLatestVersion(modelId);
    if (!version) throw ErrorFactory.notFound('Il modello non ha versioni');

    const adjacency = buildAdjacency(version.edges);
    for (const node of [start, goal]) {
      if (!adjacency.has(node)) throw ErrorFactory.badRequest(`Il nodo "${node}" non esiste nel modello`);
    }

    const cost = TokenService.costFor(version.nodeCount, version.edgeCount);

    // Addebito e calcolo nella stessa transazione: se il calcolo fallisce l'addebito viene annullato
    return Database.getInstance().transaction(async (tx): Promise<ExecuteModelResult> => {
      const remainingTokens = await TokenService.charge(userId, cost, tx);

      // Il cronometro include la costruzione del grafo
      const t0 = performance.now();
      const route = new Graph(adjacency);
      const result = route.path(start, goal, { cost: true });
      const executionTimeMs = performance.now() - t0;

      const base = { modelId, versionNumber: version.versionNumber, start, goal, executionTimeMs, tokensCharged: cost, remainingTokens };
      // node-dijkstra restituisce path null anche per start == goal: il percorso banale è [start] a costo 0
      if (start === goal) return { ...base, path: [start], cost: 0 };
      if (Array.isArray(result) || result.path === null) return { ...base, path: null, cost: null };
      return { ...base, path: result.path, cost: round4(result.cost) };
    });
  }
}
