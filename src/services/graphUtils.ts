/** Arco con peso, come salvato nel DB (il peso DECIMAL arriva come stringa o numero) */
export interface WeightedEdge {
  fromNode: string;
  toNode: string;
  weight: string | number;
}

/** Arrotonda a 4 decimali (precisione dei pesi e dei costi nel DB) */
export const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Costruisce la mappa di adiacenza accettata da node-dijkstra (nodo -> { vicino: peso }) */
export function buildAdjacency(edges: WeightedEdge[]): Map<string, Map<string, number>> {
  const adjacency = new Map<string, Map<string, number>>();
  for (const e of edges) {
    if (!adjacency.has(e.fromNode)) adjacency.set(e.fromNode, new Map());
    if (!adjacency.has(e.toNode)) adjacency.set(e.toNode, new Map());
    adjacency.get(e.fromNode)?.set(e.toNode, Number(e.weight));
  }
  return adjacency;
}
