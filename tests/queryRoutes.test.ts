import request from 'supertest';
import { createApp } from '../src/app';
import { ModelDao } from '../src/dao/ModelDao';
import { UserDao } from '../src/dao/UserDao';
import { WeightRequestDao } from '../src/dao/WeightRequestDao';
import { Edge, GraphModel, ModelVersion, User, WeightChangeRequest } from '../src/models';
import { JwtService } from '../src/services/JwtService';
import { dayRange, requestsQuerySchema, versionsQuerySchema } from '../src/validators/querySchemas';

jest.mock('../src/dao/UserDao');
jest.mock('../src/dao/ModelDao');
jest.mock('../src/dao/WeightRequestDao');

const users = jest.mocked(UserDao);
const models = jest.mocked(ModelDao);
const requests = jest.mocked(WeightRequestDao);

const app = createApp();
const auth = `Bearer ${JwtService.sign({ userId: 2, role: 'user' })}`;

describe('querySchemas', () => {
  it('accetta filtri validi e li converte', () => {
    const parsed = requestsQuerySchema.parse({ modelId: '3', date: '2026-10-07', status: 'pending' });
    expect(parsed).toEqual({ modelId: 3, date: '2026-10-07', status: 'pending' });
    expect(versionsQuerySchema.parse({ nodes: '12', edges: '0' })).toEqual({ nodes: 12, edges: 0 });
    expect(requestsQuerySchema.parse({})).toEqual({});
  });

  it.each([
    ['status fuori enum', { status: 'boh' }],
    ['data malformata', { date: '07/10/2026' }],
    ['data inesistente', { date: '2026-02-30' }],
    ['mese 13', { date: '2026-13-01' }],
    ['modelId non numerico', { modelId: 'abc' }],
    ['modelId zero', { modelId: '0' }],
    ['parametro sconosciuto', { foo: '1' }],
  ])('rifiuta richieste: %s', (_label, query) => {
    expect(requestsQuerySchema.safeParse(query).success).toBe(false);
  });

  it.each([{ nodes: '-1' }, { edges: '1.5' }, { nodes: 'x' }, { date: 'oggi' }])('rifiuta versioni: %j', (query) => {
    expect(versionsQuerySchema.safeParse(query).success).toBe(false);
  });

  it('dayRange copre l\'intero giorno UTC', () => {
    const { start, end } = dayRange('2026-10-07');
    expect(start.toISOString()).toBe('2026-10-07T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-08T00:00:00.000Z');
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

  it('401 senza JWT', async () => {
    await request(app).get('/weight-requests').expect(401);
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

  it('date= vuoto: un solo messaggio di errore', async () => {
    const res = await request(app).get('/weight-requests?date=').set('Authorization', auth).expect(400);
    expect(res.body.error.message).toBe('date: formato richiesto YYYY-MM-DD');
  });

  it.each(['0000-01-01', '0000-12-31'])('400 per data con anno 0000 (%s)', async (d) => {
    await request(app).get(`/weight-requests?date=${d}`).set('Authorization', auth).expect(400);
    expect(requests.search).not.toHaveBeenCalled();
  });

  it.each(['0001-01-01', '9999-12-31'])('200 per data agli estremi validi (%s)', async (d) => {
    await request(app).get(`/weight-requests?date=${d}`).set('Authorization', auth).expect(200);
  });

  it.each(['status=boh', 'date=2026-02-30', 'modelId=abc', 'x=1'])('400 per query non valida (%s)', async (q) => {
    await request(app).get(`/weight-requests?${q}`).set('Authorization', auth).expect(400);
    expect(requests.search).not.toHaveBeenCalled();
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

  it('inoltra i filtri date, nodes, edges', async () => {
    await request(app).get('/models/1/versions?date=2026-10-07&nodes=3&edges=2').set('Authorization', auth).expect(200);
    const [modelId, filters] = models.listVersions.mock.calls[0];
    expect(modelId).toBe(1);
    expect(filters).toMatchObject({ nodes: 3, edges: 2 });
    expect(filters.day?.end.toISOString()).toBe('2026-10-08T00:00:00.000Z');
  });

  it('404 per modello inesistente', async () => {
    models.findById.mockResolvedValue(null);
    await request(app).get('/models/99/versions').set('Authorization', auth).expect(404);
  });

  it.each(['0000-01-01', '0000-12-31'])('400 per data con anno 0000 (%s)', async (d) => {
    await request(app).get(`/models/1/versions?date=${d}`).set('Authorization', auth).expect(400);
    expect(models.listVersions).not.toHaveBeenCalled();
  });

  it.each(['0001-01-01', '9999-12-31'])('200 per data agli estremi validi (%s)', async (d) => {
    await request(app).get(`/models/1/versions?date=${d}`).set('Authorization', auth).expect(200);
  });

  it('400 per query o id non validi', async () => {
    await request(app).get('/models/1/versions?nodes=-2').set('Authorization', auth).expect(400);
    await request(app).get('/models/abc/versions').set('Authorization', auth).expect(400);
  });
});
