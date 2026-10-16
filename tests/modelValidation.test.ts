import { TokenService } from '../src/services/TokenService';
import { createModelSchema, graphStats } from '../src/validators/modelSchemas';

const valid = { name: 'Test', graph: { A: { B: 1, C: 2 }, B: { C: 1 }, C: {} } };

describe('TokenService.costFor', () => {
  it('10 nodi + 15 archi = 2.15 senza errori di arrotondamento', () => {
    expect(TokenService.costFor(10, 15)).toBe(2.15);
  });

  it('3 nodi + 3 archi = 0.63', () => {
    expect(TokenService.costFor(3, 3)).toBe(0.63);
  });
});

describe('createModelSchema', () => {
  it('accetta un grafo valido', () => {
    expect(createModelSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['peso zero', { A: { B: 0 }, B: {} }],
    ['peso negativo', { A: { B: -2 }, B: {} }],
    ['peso non numerico', { A: { B: 'x' }, B: {} }],
    ['vicino non dichiarato', { A: { B: 1 } }],
    ['arco su se stesso', { A: { A: 1 } }],
    ['grafo vuoto', {}],
    ['nessun arco', { A: {}, B: {} }],
    ['troppi decimali', { A: { B: 1.123456 }, B: {} }],
  ])('rifiuta: %s', (_label, graph) => {
    expect(createModelSchema.safeParse({ name: 'Test', graph }).success).toBe(false);
  });

  it('rifiuta un nome vuoto', () => {
    expect(createModelSchema.safeParse({ ...valid, name: '  ' }).success).toBe(false);
  });

  it.each(['constructor', 'toString'])('rifiuta il vicino non dichiarato "%s" (nome che esiste nel prototipo)', (nome) => {
    const graph = { A: { [nome]: 1 } };
    const result = createModelSchema.safeParse({ name: 'Test', graph });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message).join(' ')).toContain('non è dichiarato');
  });

  it('accetta nodi chiamati constructor e toString se sono dichiarati, e li conta', () => {
    const graph = { A: { constructor: 1 }, constructor: { toString: 2 }, toString: { A: 3 } };
    const result = createModelSchema.safeParse({ name: 'Test', graph });
    expect(result.success).toBe(true);
    if (result.success) expect(graphStats(result.data.graph)).toEqual({ nodes: 3, edges: 3 });
  });
});

describe('nome di nodo __proto__', () => {
  it.each([
    ['come nodo', '{"A":{"B":1},"B":{"A":1},"__proto__":{"A":1}}'],
    ['come vicino', '{"A":{"__proto__":1},"B":{"A":1}}'],
  ])('rifiuta con messaggio chiaro: %s', (_label, json) => {
    const result = createModelSchema.safeParse({ name: 'Test', graph: JSON.parse(json) });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message).join(' ')).toContain('__proto__');
  });
});
