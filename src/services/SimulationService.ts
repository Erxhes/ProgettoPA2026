import Graph from 'node-dijkstra';
import { ModelDao } from '../dao/ModelDao';
import { ErrorFactory } from '../errors/ErrorFactory';
import { SimulationInput, stepCount } from '../validators/simulationSchemas';
import { buildAdjacency, round4 } from './graphUtils';

/** Risultato del percorso minimo per un valore del peso simulato. */
export interface StepResult {
  weight: number;
  /** null se goal non è raggiungibile da start con questo peso. */
  path: string[] | null;
  cost: number | null;
}

export interface BestResult extends StepResult {
  /** Configurazione completa dei pesi del grafo usata per questo risultato. */
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
  /** Risultato con il costo di percorso minore (a parità, il peso più piccolo); null se mai raggiungibile. */
  best: BestResult | null;
  executionTimeMs: number;
}

/**
 * Valori del peso da simulare: initial + i * step per i = 0..n, arrotondati a 4 decimali.
 * Il peso finale è incluso se è raggiungibile con un numero intero di passi.
 */
export function weightSteps(initial: number, final: number, step: number): number[] {
  const n = stepCount(initial, final, step);
  return Array.from({ length: n }, (_, i) => round4(initial + i * step));
}

/** Simulazione dell'effetto della variazione del peso di un arco sul percorso minimo. */
export class SimulationService {
  /**
   * Fa variare il peso di un arco sulla versione corrente del modello e calcola il percorso minimo a ogni passo.
   * Non consuma token e non modifica il modello.
   * @throws NOT_FOUND se il modello o l'arco non esistono, BAD_REQUEST se start/goal non sono nodi del modello
   */
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

    let bestStep: StepResult | null = null;
    for (const r of results) {
      if (r.cost !== null && (bestStep === null || r.cost < (bestStep.cost as number))) bestStep = r;
    }
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
}
