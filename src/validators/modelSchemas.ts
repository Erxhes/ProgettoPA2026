import { z } from 'zod';

/** Grafo nel formato di node-dijkstra: nodo -> { vicino: peso }. */
export type GraphInput = Record<string, Record<string, number>>;

/** Numero massimo di nodi di un grafo. */
export const MAX_NODES = 500;
/** Numero massimo di archi di un grafo. */
export const MAX_EDGES = 5000;
const MAX_WEIGHT = 1_000_000;

/** Numero di nodi (chiavi) e di archi (somma dei vicini) di un grafo. */
export function graphStats(graph: GraphInput): { nodes: number; edges: number } {
  const keys = Object.keys(graph);
  return { nodes: keys.length, edges: keys.reduce((sum, k) => sum + Object.keys(graph[k]).length, 0) };
}

const weightSchema = z
  .number()
  .finite()
  .positive('il peso deve essere maggiore di 0')
  .lt(MAX_WEIGHT)
  .refine((w) => Math.round(w * 1e4) / 1e4 === w, 'al massimo 4 decimali');

const graphSchema = z
  .record(z.string().min(1).max(50), z.record(z.string().min(1).max(50), weightSchema))
  .superRefine((graph, ctx) => {
    const { nodes, edges } = graphStats(graph);
    if (nodes === 0 || edges === 0) {
      ctx.addIssue({ code: 'custom', message: 'il grafo deve contenere almeno un nodo e un arco' });
    }
    if (nodes > MAX_NODES || edges > MAX_EDGES) {
      ctx.addIssue({ code: 'custom', message: `massimo ${MAX_NODES} nodi e ${MAX_EDGES} archi` });
    }
    // I nodi della versione si ricavano dagli archi: un nodo senza archi andrebbe perso.
    const connected = new Set<string>();
    for (const [from, neighbors] of Object.entries(graph)) {
      for (const to of Object.keys(neighbors)) {
        connected.add(from).add(to);
        if (to === from) ctx.addIssue({ code: 'custom', message: `arco ${from}->${to} su se stesso non ammesso` });
        if (!Object.hasOwn(graph, to)) ctx.addIssue({ code: 'custom', message: `il nodo "${to}" (vicino di "${from}") non è dichiarato nel grafo` });
      }
    }
    for (const node of Object.keys(graph)) {
      if (!connected.has(node)) ctx.addIssue({ code: 'custom', message: `il nodo "${node}" non ha archi entranti né uscenti` });
    }
  });

/**
 * Rifiuta i nomi di nodo `__proto__` sul dato grezzo: dopo il parsing di zod la chiave sarebbe
 * già stata scartata in silenzio e il grafo salvato differirebbe da quello inviato.
 */
function rejectProtoNames(raw: unknown, ctx: z.RefinementCtx): void {
  if (typeof raw !== 'object' || raw === null) return;
  for (const [from, neighbors] of Object.entries(raw)) {
    const names = [from];
    if (typeof neighbors === 'object' && neighbors !== null) names.push(...Object.keys(neighbors));
    if (names.includes('__proto__')) {
      ctx.addIssue({ code: 'custom', message: 'il nome di nodo "__proto__" non è ammesso' });
      return;
    }
  }
}

/** Corpo di POST /models. */
export const createModelSchema = z.object({
  name: z.string().trim().min(1).max(100),
  graph: z.unknown().superRefine(rejectProtoNames).pipe(graphSchema),
});

/** Corpo di POST /models/:id/execute. */
export const executeModelSchema = z.object({
  start: z.string().min(1).max(50),
  goal: z.string().min(1).max(50),
});

/** Parametro :id (intero positivo). */
export const idParamSchema = z.object({ id: z.string().regex(/^\d+$/, 'id non valido') });
