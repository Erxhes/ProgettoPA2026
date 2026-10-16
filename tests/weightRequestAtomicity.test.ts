import request from 'supertest';
import { createApp } from '../src/app';
import { Database } from '../src/config/database';
import { ModelDao } from '../src/dao/ModelDao';
import { UserDao } from '../src/dao/UserDao';
import { WeightRequestDao } from '../src/dao/WeightRequestDao';
import { Edge, GraphModel, ModelVersion, User, WeightChangeRequest } from '../src/models';
import { JwtService } from '../src/services/JwtService';
import { WeightRequestService } from '../src/services/WeightRequestService';

jest.mock('../src/dao/UserDao');
jest.mock('../src/dao/ModelDao');
jest.mock('../src/dao/WeightRequestDao');

const users = jest.mocked(UserDao);
const models = jest.mocked(ModelDao);
const requests = jest.mocked(WeightRequestDao);

const app = createApp();
const owner = `Bearer ${JwtService.sign({ userId: 2, role: 'user' })}`;

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

/** Stato "su disco" della richiesta e delle versioni: cambia solo se la transazione termina senza errori. */
interface Committed {
  status: string;
  versions: number;
  rollbacks: number;
}

let committed: Committed;
let live: WeightChangeRequest;

/**
 * Simula una transazione: le transazioni sono eseguite una alla volta (come il lock FOR UPDATE sul modello)
 * e le scritture diventano definitive solo se la callback non lancia.
 */
function installFakeTransaction(): void {
  let queue: Promise<unknown> = Promise.resolve();
  jest.spyOn(Database.getInstance(), 'transaction').mockImplementation(((fn: (tx: unknown) => Promise<unknown>) => {
    const run = queue.then(async () => {
      const snapshot = { status: live.status, resultingVersionId: live.resultingVersionId };
      const versionsBefore = committed.versions;
      try {
        const out = await fn({});
        committed.status = live.status;
        return out;
      } catch (err) {
        // rollback: ripristina l'oggetto richiesta e le versioni create
        live.status = snapshot.status;
        live.resultingVersionId = snapshot.resultingVersionId;
        committed.versions = versionsBefore;
        committed.rollbacks += 1;
        throw err;
      }
    });
    queue = run.catch(() => undefined);
    return run;
  }) as never);
}

beforeEach(() => {
  jest.resetAllMocks();
  committed = { status: 'pending', versions: 1, rollbacks: 0 };
  live = {
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
  installFakeTransaction();
  users.findById.mockResolvedValue({ tokens: '50.00' } as User);
  models.lockById.mockResolvedValue({ id: 1, ownerId: 2 } as GraphModel);
  models.findById.mockResolvedValue({ id: 1, ownerId: 2 } as GraphModel);
  models.findLatestVersion.mockResolvedValue(version());
  requests.findById.mockImplementation(async () => live);
  requests.save.mockImplementation(async (r) => r);
  models.addVersion.mockImplementation(async () => {
    committed.versions += 1;
    return { id: 20, versionNumber: 2 } as ModelVersion;
  });
});

describe('approvazione: atomicità', () => {
  it('se addVersion fallisce la transazione è annullata e la richiesta resta pending', async () => {
    models.addVersion.mockRejectedValue(new Error('db down'));
    await expect(WeightRequestService.approve(2, 3)).rejects.toThrow('db down');
    expect(committed.rollbacks).toBe(1);
    expect(live.status).toBe('pending');
    expect(committed.status).toBe('pending');
    expect(committed.versions).toBe(1);
    expect(requests.save).not.toHaveBeenCalled();
  });

  it('se save fallisce la transazione è annullata: nessuna nuova versione e richiesta pending', async () => {
    requests.save.mockRejectedValue(new Error('db down'));
    await expect(WeightRequestService.approve(2, 3)).rejects.toThrow('db down');
    expect(committed.rollbacks).toBe(1);
    expect(live.status).toBe('pending');
    expect(live.resultingVersionId).toBeNull();
    expect(committed.status).toBe('pending');
    expect(committed.versions).toBe(1);
  });

  it('senza errori la transazione rende definitivi stato e versione', async () => {
    await WeightRequestService.approve(2, 3);
    expect(committed).toEqual({ status: 'approved', versions: 2, rollbacks: 0 });
  });
});

describe('approvazione doppia della stessa richiesta', () => {
  it('un solo 200 e un 409, una sola nuova versione', async () => {
    const approve = () => request(app).patch('/weight-requests/3/approve').set('Authorization', owner);
    const [a, b] = await Promise.all([approve(), approve()]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(models.addVersion).toHaveBeenCalledTimes(1);
    expect(committed.versions).toBe(2);
    expect(committed.status).toBe('approved');
  });
});
