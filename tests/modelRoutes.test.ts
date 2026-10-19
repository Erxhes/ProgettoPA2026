import request from 'supertest';
import { createApp } from '../src/app';
import { ModelDao } from '../src/dao/ModelDao';
import { Database } from '../src/config/database';
import { UserDao } from '../src/dao/UserDao';
import { Edge, GraphModel, ModelVersion, User } from '../src/models';
import { JwtService } from '../src/services/JwtService';

jest.mock('../src/dao/UserDao');
jest.mock('../src/dao/ModelDao');

const users = jest.mocked(UserDao);
const models = jest.mocked(ModelDao);

const app = createApp();
const auth = `Bearer ${JwtService.sign({ userId: 4, role: 'user' })}`;
const graph = { A: { B: 1, C: 5 }, B: { C: 1, D: 7 }, C: { D: 2 }, D: {}, E: { A: 1 } };

/** Versione di test: stesso grafo, 5 nodi e 6 archi. */
function version(): ModelVersion & { edges: Edge[] } {
  const edges = Object.entries(graph).flatMap(([f, ns]) =>
    Object.entries(ns).map(([t, w]) => ({ fromNode: f, toNode: t, weight: String(w) })),
  );
  return { versionNumber: 2, nodeCount: 5, edgeCount: edges.length, edges } as unknown as ModelVersion & { edges: Edge[] };
}

beforeEach(() => {
  jest.resetAllMocks();
  // Nessuna connessione reale: la transazione esegue direttamente la callback.
  jest
    .spyOn(Database.getInstance(), 'transaction')
    .mockImplementation(((fn: (tx: unknown) => Promise<unknown>) => fn({})) as never);
  users.findById.mockResolvedValue({ tokens: '50.00' } as User);
});

describe('POST /models', () => {
  it('401 senza JWT', async () => {
    await request(app).post('/models').send({ name: 'x', graph }).expect(401);
  });

  it('400 con grafo non valido', async () => {
    await request(app).post('/models').set('Authorization', auth).send({ name: 'x', graph: { A: { B: -1 }, B: {} } }).expect(400);
  });

  it('201 addebita 0.20 per nodo + 0.01 per arco', async () => {
    users.deductTokens.mockResolvedValue(48.94);
    models.createWithFirstVersion.mockResolvedValue({
      model: { id: 9, name: 'x' } as GraphModel,
      version: { versionNumber: 1 } as ModelVersion,
    });
    const res = await request(app).post('/models').set('Authorization', auth).send({ name: 'x', graph }).expect(201);
    expect(res.body).toMatchObject({ id: 9, nodes: 5, edges: 6, tokensCharged: 1.06, remainingTokens: 48.94 });
    expect(users.deductTokens).toHaveBeenCalledWith(4, 1.06, expect.anything());
  });

  it('401 e nessun modello creato se il credito non basta', async () => {
    users.deductTokens.mockResolvedValue(null);
    const res = await request(app).post('/models').set('Authorization', auth).send({ name: 'x', graph }).expect(401);
    expect(res.body.error.code).toBe('INSUFFICIENT_TOKENS');
    expect(models.createWithFirstVersion).not.toHaveBeenCalled();
  });
});

describe('POST /models/:id/execute', () => {
  beforeEach(() => {
    models.findById.mockResolvedValue({ id: 1 } as GraphModel);
    models.findLatestVersion.mockResolvedValue(version());
    users.deductTokens.mockResolvedValue(48.94);
  });

  const exec = (id: string, body: object) =>
    request(app).post(`/models/${id}/execute`).set('Authorization', auth).send(body);

  it('200 con percorso ottimo, costo dei pesi e tempo', async () => {
    const res = await exec('1', { start: 'A', goal: 'D' }).expect(200);
    expect(res.body).toMatchObject({ path: ['A', 'B', 'C', 'D'], cost: 4, tokensCharged: 1.06, versionNumber: 2 });
    expect(typeof res.body.executionTimeMs).toBe('number');
  });

  it('400 per nodo sconosciuto, senza addebito', async () => {
    await exec('1', { start: 'A', goal: 'Z' }).expect(400);
    expect(users.deductTokens).not.toHaveBeenCalled();
  });
});
