import { Database } from '../src/config/database';
import { Edge, GraphModel, ModelVersion, User, WeightChangeRequest } from '../src/models';
import { runSeed } from '../src/seeders/seed';

/** Transazione simulata: registra se la callback ha portato a commit o a rollback. */
function fakeTransaction(): { outcome: () => string; tx: object } {
  let outcome = 'nessuna transazione';
  const tx = { id: 'fake-tx' };
  jest.spyOn(Database.getInstance(), 'transaction').mockImplementation((async (fn: (t: unknown) => Promise<unknown>) => {
    try {
      const result = await fn(tx);
      outcome = 'commit';
      return result;
    } catch (err) {
      outcome = 'rollback';
      throw err;
    }
  }) as never);
  return { outcome: () => outcome, tx };
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(Database.getInstance(), 'sync').mockResolvedValue(Database.getInstance());
  jest.spyOn(User, 'count').mockResolvedValue(0);
  jest.spyOn(User, 'create').mockImplementation((async (v: { email: string }) => ({ id: v.email.length, ...v })) as never);
  jest.spyOn(GraphModel, 'create').mockImplementation((async () => ({ id: 1 })) as never);
  jest.spyOn(ModelVersion, 'create').mockImplementation((async () => ({ id: 1 })) as never);
  jest.spyOn(Edge, 'bulkCreate').mockResolvedValue([] as never);
  jest.spyOn(WeightChangeRequest, 'bulkCreate').mockResolvedValue([] as never);
});

describe('runSeed', () => {
  it('esegue tutti gli inserimenti nella stessa transazione', async () => {
    const { outcome, tx } = fakeTransaction();
    await runSeed(false);
    expect(outcome()).toBe('commit');
    const optionsOf = (call: unknown[]) => call[call.length - 1] as { transaction?: unknown };
    for (const spy of [User.create, GraphModel.create, ModelVersion.create, Edge.bulkCreate, WeightChangeRequest.bulkCreate]) {
      const calls = jest.mocked(spy).mock.calls as unknown[][];
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) expect(optionsOf(call).transaction).toBe(tx);
    }
  });

  it('se un inserimento fallisce fa rollback e propaga l\'errore', async () => {
    const { outcome } = fakeTransaction();
    jest.spyOn(WeightChangeRequest, 'bulkCreate').mockRejectedValue(new Error('inserimento fallito'));
    await expect(runSeed(false)).rejects.toThrow('inserimento fallito');
    expect(outcome()).toBe('rollback');
  });
});
