import request from 'supertest';
import { createApp } from '../src/app';
import { ModelDao } from '../src/dao/ModelDao';
import { UserDao } from '../src/dao/UserDao';
import { WeightRequestDao } from '../src/dao/WeightRequestDao';
import { Edge, GraphModel, ModelVersion, User, WeightChangeRequest } from '../src/models';
import { JwtService } from '../src/services/JwtService';
import { requestsQuerySchema } from '../src/validators/querySchemas';

jest.mock('../src/dao/UserDao');
jest.mock('../src/dao/ModelDao');
jest.mock('../src/dao/WeightRequestDao');

const users = jest.mocked(UserDao);
const models = jest.mocked(ModelDao);
const requests = jest.mocked(WeightRequestDao);

const app = createApp();
const auth = `Bearer ${JwtService.sign({ userId: 2, role: 'user' })}`;

describe('querySchemas', () => {
  it.each([
    ['status fuori enum', { status: 'boh' }],
    ['data inesistente', { date: '2026-02-30' }],
  ])('rifiuta richieste: %s', (_label, query) => {
    expect(requestsQuerySchema.safeParse(query).success).toBe(false);
  });
});

beforeEach(() => {
  jest.resetAllMocks();
  users.findById.mockResolvedValue({ tokens: '50.00' } as User);
});

describe('GET /weight-requests', () => {
  const row = {
    id: 3,
    modelId: 1,
    requesterId: 4,
    fromNode: 'A',
    toNode: 'B',
    newWeight: '5.0000',
    status: 'pending',
    rejectionReason: null,
    resultingVersionId: null,
    createdAt: new Date('2026-10-07T10:00:00Z'),
    decidedAt: null,
  } as unknown as WeightChangeRequest;

  beforeEach(() => {
    models.findIdsByOwner.mockResolvedValue([1]);
    requests.search.mockResolvedValue([row]);
  });

  it('200 senza filtri: la ricerca è limitata alle richieste visibili all\'utente', async () => {
    const res = await request(app).get('/weight-requests').set('Authorization', auth).expect(200);
    expect(res.body.count).toBe(1);
    expect(res.body.requests[0]).toMatchObject({ id: 3, status: 'pending', from: 'A', to: 'B', newWeight: 5 });
    expect(requests.search).toHaveBeenCalledWith({
      requesterId: 2,
      ownedModelIds: [1],
      modelId: undefined,
      status: undefined,
      day: undefined,
    });
  });

  it('inoltra i filtri combinati al DAO', async () => {
    await request(app)
      .get('/weight-requests?modelId=1&status=approved&date=2026-10-07')
      .set('Authorization', auth)
      .expect(200);
    const arg = requests.search.mock.calls[0][0];
    expect(arg).toMatchObject({ modelId: 1, status: 'approved' });
    expect(arg.day?.start.toISOString()).toBe('2026-10-07T00:00:00.000Z');
  });
});

describe('GET /models/:id/versions', () => {
  const versionRow = {
    versionNumber: 2,
    nodeCount: 3,
    edgeCount: 2,
    createdAt: new Date('2026-10-07T10:00:00Z'),
    edges: [
      { fromNode: 'A', toNode: 'B', weight: '7.7000' },
      { fromNode: 'B', toNode: 'C', weight: '2.0000' },
    ],
  } as unknown as ModelVersion & { edges: Edge[] };

  beforeEach(() => {
    models.findById.mockResolvedValue({ id: 1 } as GraphModel);
    models.listVersions.mockResolvedValue([versionRow]);
  });

  it('200 con versioni e pesi', async () => {
    const res = await request(app).get('/models/1/versions').set('Authorization', auth).expect(200);
    expect(res.body).toMatchObject({ modelId: 1, count: 1 });
    expect(res.body.versions[0]).toMatchObject({
      versionNumber: 2,
      nodeCount: 3,
      edgeCount: 2,
      edges: [
        { from: 'A', to: 'B', weight: 7.7 },
        { from: 'B', to: 'C', weight: 2 },
      ],
    });
  });
});
