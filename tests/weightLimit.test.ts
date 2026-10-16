import { createModelSchema } from '../src/validators/modelSchemas';
import { createWeightRequestSchema } from '../src/validators/requestSchemas';

/** Il peso è salvato in numeric(10,4): il massimo rappresentabile è 999999.9999. */
describe('limite superiore del peso', () => {
  const model = (w: number) => createModelSchema.safeParse({ name: 'x', graph: { A: { B: w }, B: {} } });
  const req = (w: number) => createWeightRequestSchema.safeParse({ from: 'A', to: 'B', newWeight: w });

  it('modello: 999999.9999 accettato, 1000000 rifiutato', () => {
    expect(model(999999.9999).success).toBe(true);
    expect(model(1_000_000).success).toBe(false);
  });

  it('richiesta di cambio peso: 999999.9999 accettato, 1000000 rifiutato', () => {
    expect(req(999999.9999).success).toBe(true);
    expect(req(1_000_000).success).toBe(false);
  });
});
