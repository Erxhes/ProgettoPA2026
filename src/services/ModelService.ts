import Graph from 'node-dijkstra';
import { Database } from '../config/database';
import { EdgeInput, ModelDao } from '../dao/ModelDao';
import { ErrorFactory } from '../errors/ErrorFactory';
import { graphStats, GraphInput } from '../validators/modelSchemas';
import { dayRange, VersionsQuery } from '../validators/querySchemas';
import { SimulationInput, stepCount } from '../validators/simulationSchemas';
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

/** Risultato del percorso minimo per un valore del peso simulato */
export interface StepResult {
  weight: number;
  /** null se goal non è raggiungibile da start con questo peso */
  path: string[] | null;
  cost: number | null;
}

export interface BestResult extends StepResult {
  /** Configurazione completa dei pesi del grafo usata per questo risultato */
  weights: { from: string; to: string; weight: number }[];
}

export interface SimulationResult {
  modelId: number;
  versionNumber: number;
  start: string;
  goal: string;
  edge: { from: string; to: string };
  count: number;
  results: StepResult[];
  /** Risultato col costo minore (a parità il peso più piccolo), null se non c'è mai un percorso */
  best: BestResult | null;
  executionTimeMs: number;
}

/** Valori del peso da simulare: initial + i * step per i = 0..n, arrotondati a 4 decimali */
export function weightSteps(initial: number, final: number, step: number): number[] {
  const n = stepCount(initial, final, step);
  return Array.from({ length: n }, (_, i) => round4(initial + i * step));
}

/** Versione dei pesi di un modello, con i pesi di tutti gli archi */
export interface VersionView {
  versionNumber: number;
  nodeCount: number;
  edgeCount: number;
  /** Data di modifica (creazione della versione) */
  modifiedAt: Date;
  edges: { from: string; to: string; weight: number }[];
}

/** Logica di business dei modelli: creazione, esecuzione, simulazione e versioni dei pesi */
export class ModelService {
  /** Crea un modello (versione 1) addebitando 0.20 per nodo + 0.01 per arco */
  static async create(userId: number, name: string, graph: GraphInput): Promise<CreateModelResult> {
    const { nodes, edges } = graphStats(graph);
    const cost = TokenService.costFor(nodes, edges);
    // trasformo il grafo { nodo: { vicino: peso } } in una lista di archi [da, a, peso]
    const edgeList: EdgeInput[] = Object.entries(graph).flatMap(([from, neighbors]) =>
      Object.entries(neighbors).map(([to, weight]): EdgeInput => [from, to, weight]),
    );

    // addebito e creazione nella stessa transazione: se i token non bastano non viene creato nulla
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
    // start e goal devono essere nodi del grafo
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

  /** Fa variare il peso di un arco e calcola il percorso minimo a ogni passo (non costa token) */
  static async simulate(modelId: number, input: SimulationInput): Promise<SimulationResult> {
    if (!(await ModelDao.findById(modelId))) throw ErrorFactory.notFound('Modello non trovato');
    const version = await ModelDao.findLatestVersion(modelId);
    if (!version) throw ErrorFactory.notFound('Il modello non ha versioni');

    const { start, goal, edge } = input;
    const adjacency = buildAdjacency(version.edges);
    if (!adjacency.get(edge.from)?.has(edge.to)) {
      throw ErrorFactory.notFound(`Arco ${edge.from}->${edge.to} non presente nel modello`);
    }
    for (const node of [start, goal]) {
      if (!adjacency.has(node)) throw ErrorFactory.badRequest(`Il nodo "${node}" non esiste nel modello`);
    }

    // per ogni valore del peso rifaccio il percorso minimo sul grafo con quell'arco cambiato
    const t0 = performance.now();
    const results: StepResult[] = [];
    for (const weight of weightSteps(input.initialWeight, input.finalWeight, input.step)) {
      adjacency.get(edge.from)?.set(edge.to, weight);
      const found = new Graph(adjacency).path(start, goal, { cost: true });
      if (start === goal) {
        // node-dijkstra restituisce path null per start == goal: il percorso banale è [start] a costo 0 (come in execute)
        results.push({ weight, path: [start], cost: 0 });
      } else if (Array.isArray(found) || found.path === null) {
        results.push({ weight, path: null, cost: null });
      } else {
        results.push({ weight, path: found.path, cost: round4(found.cost) });
      }
    }
    const executionTimeMs = performance.now() - t0;

    // il migliore è quello col costo più basso; a parità resta il primo, cioè il peso più piccolo
    let bestStep: StepResult | null = null;
    for (const r of results) {
      if (r.cost !== null && (bestStep === null || r.cost < (bestStep.cost as number))) bestStep = r;
    }
    // per il migliore ricostruisco anche tutti i pesi del grafo
    const best: BestResult | null = bestStep && {
      ...bestStep,
      weights: version.edges.map((e) => ({
        from: e.fromNode,
        to: e.toNode,
        weight: e.fromNode === edge.from && e.toNode === edge.to ? (bestStep as StepResult).weight : Number(e.weight),
      })),
    };

    return {
      modelId,
      versionNumber: version.versionNumber,
      start,
      goal,
      edge,
      count: results.length,
      results,
      best,
      executionTimeMs,
    };
  }

  /** Elenca le versioni di un modello con filtri opzionali in AND (giorno di modifica, nodi, archi) */
  static async listVersions(modelId: number, filters: VersionsQuery): Promise<VersionView[]> {
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
