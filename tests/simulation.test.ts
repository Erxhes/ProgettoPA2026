import request from 'supertest';
import { createApp } from '../src/app';
import { ModelDao } from '../src/dao/ModelDao';
import { UserDao } from '../src/dao/UserDao';
import { Edge, GraphModel, ModelVersion, User } from '../src/models';
import { JwtService } from '../src/services/JwtService';
import { ModelService, weightSteps } from '../src/services/ModelService';
import { simulationSchema } from '../src/validators/simulationSchemas';

jest.mock('../src/dao/UserDao');
jest.mock('../src/dao/ModelDao');

const users = jest.mocked(UserDao);
const models = jest.mocked(ModelDao);

const app = createApp();
const auth = `Bearer ${JwtService.sign({ userId: 4, role: 'user' })}`;

/**
 * Grafo di test: A->B (simulato), A->C 2, C->B 2, B->D 1, D->E 1 (da E non si raggiunge nessun nodo).
 * Da A a D: via A->B costa w + 1; via C costa 5. Oltre w = 4 conviene passare da C.
 */
function version(): ModelVersion & { edges: Edge[] } {
  const edges = [
    { fromNode: 'A', toNode: 'B', weight: '3.0000' },
    { fromNode: 'A', toNode: 'C', weight: '2.0000' },
    { fromNode: 'C', toNode: 'B', weight: '2.0000' },
    { fromNode: 'B', toNode: 'D', weight: '1.0000' },
    { fromNode: 'D', toNode: 'E', weight: '1.0000' },
  ];
  return { versionNumber: 2, nodeCount: 5, edgeCount: 5, edges } as unknown as ModelVersion & { edges: Edge[] };
}

const valid = {
  start: 'A',
  goal: 'D',
  edge: { from: 'A', to: 'B' },
  initialWeight: 1,
  finalWeight: 6,
  step: 1,
};

describe('weightSteps', () => {
  it('da 1 a 2 con passo 0.05 dà 21 valori, ultimo 2', () => {
    const steps = weightSteps(1, 2, 0.05);
    expect(steps).toHaveLength(21);
    expect(steps[0]).toBe(1);
    expect(steps[1]).toBe(1.05);
    expect(steps[20]).toBe(2);
  });
});

describe('simulationSchema', () => {
  it('accetta una richiesta valida', () => {
    expect(simulationSchema.safeParse(valid).success).toBe(true);
    expect(simulationSchema.safeParse({ ...valid, initialWeight: 1, finalWeight: 2, step: 0.05 }).success).toBe(true);
  });

  it('rifiuta: iniziale > finale', () => {
    expect(simulationSchema.safeParse({ ...valid, initialWeight: 5, finalWeight: 2 }).success).toBe(false);
  });
});

describe('ModelService.simulate', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    models.findById.mockResolvedValue({ id: 1 } as GraphModel);
    models.findLatestVersion.mockResolvedValue(version());
  });

  it('il percorso cambia oltre la soglia e il best è il costo minore', async () => {
    const res = await ModelService.simulate(1, valid);
    expect(res.count).toBe(6);
    expect(res.results.map((r) => r.cost)).toEqual([2, 3, 4, 5, 5, 5]);
    expect(res.results[0].path).toEqual(['A', 'B', 'D']);
    expect(res.results[5].path).toEqual(['A', 'C', 'B', 'D']);
    expect(res.versionNumber).toBe(2);
  });

  it('a parità di costo vince il peso più piccolo', async () => {
    // Da 4 a 6 il costo è sempre 5 (si passa da C): best = peso 4.
    const res = await ModelService.simulate(1, { ...valid, initialWeight: 4, finalWeight: 6 });
    expect(res.results.map((r) => r.cost)).toEqual([5, 5, 5]);
    expect(res.best?.weight).toBe(4);
  });
});

describe('POST /models/:id/simulate', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    users.findById.mockResolvedValue({ tokens: '50.00' } as User);
    models.findById.mockResolvedValue({ id: 1 } as GraphModel);
    models.findLatestVersion.mockResolvedValue(version());
  });

  const post = (body: object, id = '1') =>
    request(app).post(`/models/${id}/simulate`).set('Authorization', auth).send(body);

  it('200 con tutti i risultati e il best, senza addebitare token', async () => {
    const res = await post(valid).expect(200);
    expect(res.body.count).toBe(6);
    expect(res.body.best).toMatchObject({ weight: 1, cost: 2 });
    expect(typeof res.body.executionTimeMs).toBe('number');
    expect(users.deductTokens).not.toHaveBeenCalled();
  });

  it('400 per range non ammissibile', async () => {
    await post({ ...valid, initialWeight: 5, finalWeight: 2 }).expect(400);
    await post({ ...valid, step: 0 }).expect(400);
  });
});
