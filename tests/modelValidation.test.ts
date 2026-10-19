import { TokenService } from '../src/services/TokenService';
import { createModelSchema } from '../src/validators/modelSchemas';

const valid = { name: 'Test', graph: { A: { B: 1, C: 2 }, B: { C: 1 }, C: {} } };

describe('TokenService.costFor', () => {
  it('10 nodi + 15 archi = 2.15 senza errori di arrotondamento', () => {
    expect(TokenService.costFor(10, 15)).toBe(2.15);
  });
});

describe('createModelSchema', () => {
  it('accetta un grafo valido', () => {
    expect(createModelSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['peso negativo', { A: { B: -2 }, B: {} }],
    ['vicino non dichiarato', { A: { B: 1 } }],
  ])('rifiuta: %s', (_label, graph) => {
    expect(createModelSchema.safeParse({ name: 'Test', graph }).success).toBe(false);
  });

  it('rifiuta un nome vuoto', () => {
    expect(createModelSchema.safeParse({ ...valid, name: '  ' }).success).toBe(false);
  });
});
