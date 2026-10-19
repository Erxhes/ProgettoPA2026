import request from 'supertest';
import { createApp } from '../src/app';
import { Database } from '../src/config/database';
import { ModelDao } from '../src/dao/ModelDao';
import { UserDao } from '../src/dao/UserDao';
import { WeightRequestDao } from '../src/dao/WeightRequestDao';
import { Edge, GraphModel, ModelVersion, User, WeightChangeRequest } from '../src/models';
import { JwtService } from '../src/services/JwtService';

jest.mock('../src/dao/UserDao');
jest.mock('../src/dao/ModelDao');
jest.mock('../src/dao/WeightRequestDao');

const users = jest.mocked(UserDao);
const models = jest.mocked(ModelDao);
const requests = jest.mocked(WeightRequestDao);

const app = createApp();
const bearer = (userId: number) => `Bearer ${JwtService.sign({ userId, role: 'user' })}`;
const owner = bearer(2);
const other = bearer(4);

/** Versione 1 di test: A->B 8, B->C 2. */
function version(): ModelVersion & { edges: Edge[] } {
  return {
    versionNumber: 1,
    nodeCount: 3,
    edgeCount: 2,
    edges: [
      { fromNode: 'A', toNode: 'B', weight: '8.0000' },
      { fromNode: 'B', toNode: 'C', weight: '2.0000' },
    ],
  } as unknown as ModelVersion & { edges: Edge[] };
}

/** Richiesta pending modificabile (per approve/reject). */
function pendingRequest(): WeightChangeRequest {
  return {
    id: 3,
    modelId: 1,
    requesterId: 4,
    fromNode: 'A',
    toNode: 'B',
    newWeight: '5.0000',
    status: 'pending',
    rejectionReason: null,
    resultingVersionId: null,
    createdAt: new Date(),
    decidedAt: null,
  } as unknown as WeightChangeRequest;
}

beforeEach(() => {
  jest.resetAllMocks();
  // Nessuna connessione reale: la transazione esegue direttamente la callback.
  jest
    .spyOn(Database.getInstance(), 'transaction')
    .mockImplementation(((fn: (tx: unknown) => Promise<unknown>) => fn({})) as never);
  users.findById.mockResolvedValue({ tokens: '50.00' } as User);
  models.findById.mockResolvedValue({ id: 1, ownerId: 2 } as GraphModel);
  models.lockById.mockResolvedValue({ id: 1, ownerId: 2 } as GraphModel);
  models.findLatestVersion.mockResolvedValue(version());
});

describe('POST /models/:id/weight-requests', () => {
  const send = (auth: string, body: object) =>
    request(app).post('/models/1/weight-requests').set('Authorization', auth).send(body);

  it('201 crea una richiesta pending (anche un utente non proprietario)', async () => {
    requests.create.mockResolvedValue(pendingRequest());
    const res = await send(other, { from: 'A', to: 'B', newWeight: 5 }).expect(201);
    expect(res.body).toMatchObject({ status: 'pending', from: 'A', to: 'B', newWeight: 5 });
    expect(requests.create).toHaveBeenCalledWith(expect.objectContaining({ requesterId: 4, modelId: 1 }));
  });

  it('400 per peso non valido', async () => {
    await send(other, { from: 'A', to: 'B', newWeight: 0 }).expect(400);
    await send(other, { from: 'A', to: 'B', newWeight: 'x' }).expect(400);
  });
});

describe('PATCH /weight-requests/:id/approve', () => {
  const approve = (auth: string) => request(app).patch('/weight-requests/3/approve').set('Authorization', auth);

  beforeEach(() => {
    requests.findById.mockResolvedValue(pendingRequest());
    models.addVersion.mockResolvedValue({ id: 20, versionNumber: 2 } as ModelVersion);
  });

  it('200: il proprietario approva, peso mediato e nuova versione con il solo arco cambiato', async () => {
    const res = await approve(owner).expect(200);
    expect(res.body).toMatchObject({ oldWeight: 8, updatedWeight: 7.7, versionNumber: 2 });
    expect(res.body.request).toMatchObject({ status: 'approved', resultingVersionId: 20 });
    expect(models.addVersion).toHaveBeenCalledWith(
      1,
      2,
      3,
      [['A', 'B', 7.7], ['B', 'C', 2]],
      expect.anything(),
    );
  });

  it('403 a un utente non proprietario', async () => {
    await approve(other).expect(403);
    expect(models.addVersion).not.toHaveBeenCalled();
  });

  it('409 se la richiesta è già stata decisa', async () => {
    requests.findById.mockResolvedValue({ ...pendingRequest(), status: 'approved' } as WeightChangeRequest);
    await approve(owner).expect(409);
    expect(models.addVersion).not.toHaveBeenCalled();
  });
});

describe('PATCH /weight-requests/:id/reject', () => {
  const reject = (auth: string, body: object) =>
    request(app).patch('/weight-requests/3/reject').set('Authorization', auth).send(body);

  beforeEach(() => {
    requests.findById.mockResolvedValue(pendingRequest());
  });

  it('400 senza motivazione', async () => {
    await reject(owner, {}).expect(400);
    await reject(owner, { reason: '   ' }).expect(400);
  });

  it('200 con motivazione: stato rejected', async () => {
    const res = await reject(owner, { reason: 'Peso non realistico' }).expect(200);
    expect(res.body).toMatchObject({ status: 'rejected', rejectionReason: 'Peso non realistico' });
    expect(models.addVersion).not.toHaveBeenCalled();
  });
});
