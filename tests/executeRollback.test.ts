import Graph from 'node-dijkstra';
import request from 'supertest';
import { createApp } from '../src/app';
import { Database } from '../src/config/database';
import { ModelDao } from '../src/dao/ModelDao';
import { UserDao } from '../src/dao/UserDao';
import { Edge, GraphModel, ModelVersion, User } from '../src/models';
import { JwtService } from '../src/services/JwtService';

jest.mock('../src/dao/UserDao');
jest.mock('../src/dao/ModelDao');

const users = jest.mocked(UserDao);
const models = jest.mocked(ModelDao);
const app = createApp();
const auth = `Bearer ${JwtService.sign({ userId: 4, role: 'user' })}`;

let outcome: 'commit' | 'rollback' | undefined;

beforeEach(() => {
  jest.resetAllMocks();
  outcome = undefined;
  // Transazione simulata: registra se la callback ha portato a commit o a rollback.
  jest.spyOn(Database.getInstance(), 'transaction').mockImplementation((async (fn: (tx: unknown) => Promise<unknown>) => {
    try {
      const value = await fn({});
      outcome = 'commit';
      return value;
    } catch (err) {
      outcome = 'rollback';
      throw err;
    }
  }) as never);
  users.findById.mockResolvedValue({ tokens: '50.00' } as User);
  users.deductTokens.mockResolvedValue(49);
  models.findById.mockResolvedValue({ id: 1 } as GraphModel);
  models.findLatestVersion.mockResolvedValue({
    versionNumber: 1,
    nodeCount: 2,
    edgeCount: 1,
    edges: [{ fromNode: 'A', toNode: 'B', weight: '1' }],
  } as unknown as ModelVersion & { edges: Edge[] });
});

afterEach(() => jest.restoreAllMocks());

describe('POST /models/:id/execute: addebito e calcolo nella stessa transazione', () => {
  it('se il calcolo lancia un errore l\'addebito viene annullato (rollback)', async () => {
    jest.spyOn(Graph.prototype, 'path').mockImplementation(() => {
      throw new Error('calcolo fallito');
    });
    await request(app).post('/models/1/execute').set('Authorization', auth).send({ start: 'A', goal: 'B' }).expect(500);
    expect(users.deductTokens).toHaveBeenCalledWith(4, 0.41, expect.anything());
    expect(outcome).toBe('rollback');
  });

  it('con calcolo riuscito la transazione va a buon fine', async () => {
    await request(app).post('/models/1/execute').set('Authorization', auth).send({ start: 'A', goal: 'B' }).expect(200);
    expect(outcome).toBe('commit');
  });
});
