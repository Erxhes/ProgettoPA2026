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

function requestWith(status: string): WeightChangeRequest {
  return {
    id: 3,
    modelId: 1,
    requesterId: 4,
    fromNode: 'A',
    toNode: 'B',
    newWeight: '5.0000',
    status,
    rejectionReason: null,
    resultingVersionId: null,
    createdAt: new Date(),
    decidedAt: null,
  } as unknown as WeightChangeRequest;
}

beforeEach(() => {
  jest.resetAllMocks();
  jest
    .spyOn(Database.getInstance(), 'transaction')
    .mockImplementation(((fn: (tx: unknown) => Promise<unknown>) => fn({})) as never);
  users.findById.mockResolvedValue({ tokens: '50.00' } as User);
  models.findById.mockResolvedValue({ id: 1, ownerId: 2 } as GraphModel);
  models.lockById.mockResolvedValue({ id: 1, ownerId: 2 } as GraphModel);
  models.findLatestVersion.mockResolvedValue(version());
  requests.save.mockImplementation(async (r) => r);
});

describe('creazione: validazione del nuovo peso', () => {
  const create = (newWeight: number) =>
    request(app).post('/models/1/weight-requests').set('Authorization', other).send({ from: 'A', to: 'B', newWeight });

  it.each([-1, -0.5, 1.12345, 1_000_000, 2_000_000])('400 per il peso %p', async (w) => {
    await create(w).expect(400);
    expect(requests.create).not.toHaveBeenCalled();
  });

  it('accetta il massimo ammesso con 4 decimali', async () => {
    requests.create.mockResolvedValue(requestWith('pending'));
    await create(999_999.9999).expect(201);
  });
});

describe('creazione: effetti collaterali', () => {
  it('non crea versioni e non addebita token', async () => {
    requests.create.mockResolvedValue(requestWith('pending'));
    await request(app)
      .post('/models/1/weight-requests')
      .set('Authorization', other)
      .send({ from: 'A', to: 'B', newWeight: 5 })
      .expect(201);
    expect(models.addVersion).not.toHaveBeenCalled();
    expect(users.deductTokens).not.toHaveBeenCalled();
    expect(users.addTokens).not.toHaveBeenCalled();
  });

  it('il proprietario del modello segue lo stesso flusso: richiesta pending', async () => {
    requests.create.mockResolvedValue({ ...requestWith('pending'), requesterId: 2 } as WeightChangeRequest);
    const res = await request(app)
      .post('/models/1/weight-requests')
      .set('Authorization', owner)
      .send({ from: 'A', to: 'B', newWeight: 5 })
      .expect(201);
    expect(res.body).toMatchObject({ status: 'pending', requesterId: 2 });
    expect(requests.create).toHaveBeenCalledWith(expect.objectContaining({ requesterId: 2, modelId: 1 }));
    expect(models.addVersion).not.toHaveBeenCalled();
  });
});

describe('decisione su richieste già decise', () => {
  const approve = () => request(app).patch('/weight-requests/3/approve').set('Authorization', owner);
  const reject = () =>
    request(app).patch('/weight-requests/3/reject').set('Authorization', owner).send({ reason: 'motivo' });

  it.each(['approved', 'rejected'])('reject su una richiesta %s: 409', async (status) => {
    requests.findById.mockResolvedValue(requestWith(status));
    await reject().expect(409);
    expect(requests.save).not.toHaveBeenCalled();
  });

  it('approve su una richiesta rifiutata: 409 e nessuna nuova versione', async () => {
    requests.findById.mockResolvedValue(requestWith('rejected'));
    await approve().expect(409);
    expect(models.addVersion).not.toHaveBeenCalled();
    expect(requests.save).not.toHaveBeenCalled();
  });

  it('approve quando l\'arco non esiste più: 409 e nessuna nuova versione', async () => {
    requests.findById.mockResolvedValue({ ...requestWith('pending'), fromNode: 'X', toNode: 'Y' } as WeightChangeRequest);
    await approve().expect(409);
    expect(models.addVersion).not.toHaveBeenCalled();
    expect(requests.save).not.toHaveBeenCalled();
  });
});

describe('motivazione del rifiuto', () => {
  const reject = (reason: unknown) =>
    request(app).patch('/weight-requests/3/reject').set('Authorization', owner).send({ reason });

  beforeEach(() => {
    requests.findById.mockResolvedValue(requestWith('pending'));
  });

  it('400 oltre 500 caratteri, 200 con esattamente 500', async () => {
    await reject('x'.repeat(501)).expect(400);
    expect(requests.save).not.toHaveBeenCalled();
    await reject('x'.repeat(500)).expect(200);
  });

  it('viene salvata senza spazi ai bordi', async () => {
    const res = await reject('   peso irrealistico \n').expect(200);
    expect(res.body.rejectionReason).toBe('peso irrealistico');
    expect(requests.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected', rejectionReason: 'peso irrealistico' }),
      expect.anything(),
    );
  });
});
