import { z } from 'zod';

/** Grafo nel formato di node-dijkstra: nodo -> { vicino: peso } */
export type GraphInput = Record<string, Record<string, number>>;

/** Numero di nodi (chiavi) e di archi (somma dei vicini) di un grafo */
export function graphStats(graph: GraphInput): { nodes: number; edges: number } {
  const keys = Object.keys(graph);
  return { nodes: keys.length, edges: keys.reduce((sum, k) => sum + Object.keys(graph[k]).length, 0) };
}

const weightSchema = z
  .number()
  .positive('il peso deve essere maggiore di 0')
  .lt(1_000_000)
  .refine((w) => Math.round(w * 1e4) / 1e4 === w, 'al massimo 4 decimali');

const graphSchema = z
  .record(z.string().min(1).max(50), z.record(z.string().min(1).max(50), weightSchema))
  .superRefine((graph, ctx) => {
    const { nodes, edges } = graphStats(graph);
    if (nodes === 0 || edges === 0) {
      ctx.addIssue({ code: 'custom', message: 'il grafo deve contenere almeno un nodo e un arco' });
    }
    // I nodi della versione si ricavano dagli archi: un nodo senza archi andrebbe perso
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

/** Controlla nome e grafo di un nuovo modello */
export const createModelSchema = z.object({
  name: z.string().trim().min(1).max(100),
  graph: graphSchema,
});

/** Controlla start e goal dell'esecuzione */
export const executeModelSchema = z.object({
  start: z.string().min(1).max(50),
  goal: z.string().min(1).max(50),
});

/** Parametro :id (intero positivo) */
/** Controlla che :id sia un numero intero */
export const idParamSchema = z.object({ id: z.string().regex(/^\d+$/, 'id non valido') });
