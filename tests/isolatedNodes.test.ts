import { createModelSchema } from '../src/validators/modelSchemas';

const parse = (graph: unknown) => createModelSchema.safeParse({ name: 'x', graph });

/** I nodi si ricavano dagli archi: un nodo senza archi andrebbe perso nella versione salvata. */
describe('nodi isolati', () => {
  it('rifiuta un nodo senza archi entranti né uscenti', () => {
    expect(parse({ A: { B: 1 }, B: {}, C: {} }).success).toBe(false);
  });

  it('accetta un nodo con soli archi in entrata', () => {
    expect(parse({ A: { B: 1 }, B: {} }).success).toBe(true);
  });

  it('accetta un nodo con soli archi in uscita', () => {
    expect(parse({ A: { B: 1 }, B: { A: 1 }, C: { A: 2 } }).success).toBe(true);
  });
});
