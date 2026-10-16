import { Op } from 'sequelize';
import request from 'supertest';
import { createApp } from '../src/app';
import { ModelDao } from '../src/dao/ModelDao';
import { UserDao } from '../src/dao/UserDao';
import { WeightRequestDao } from '../src/dao/WeightRequestDao';
import { GraphModel, ModelVersion, User, WeightChangeRequest } from '../src/models';
import { JwtService } from '../src/services/JwtService';
import { dayRange, requestsQuerySchema, versionsQuerySchema } from '../src/validators/querySchemas';

jest.mock('../src/dao/UserDao');

type Where = Record<string | symbol, unknown>;
type Row = Record<string, unknown>;

/** Valuta una clausola where Sequelize (Op.and, Op.or, Op.in, Op.gte, Op.lt, uguaglianza) su una riga in memoria. */
function matches(row: Row, where: Where): boolean {
  return Reflect.ownKeys(where).every((key) => {
    const value = where[key];
    if (key === Op.and) return (value as Where[]).every((w) => matches(row, w));
    if (key === Op.or) return (value as Where[]).some((w) => matches(row, w));
    const field = row[key as string];
    if (value instanceof Date || value === null || typeof value !== 'object') return field === value;
    const cond = value as Where;
    return Reflect.ownKeys(cond).every((op) => {
      if (op === Op.in) return (cond[op] as unknown[]).includes(field);
      if (op === Op.gte) return (field as Date) >= (cond[op] as Date);
      if (op === Op.lt) return (field as Date) < (cond[op] as Date);
      throw new Error('operatore non gestito dal test');
    });
  });
}

const users = jest.mocked(UserDao);
const app = createApp();
const asUser = (userId: number): string => `Bearer ${JwtService.sign({ userId, role: 'user' })}`;

function row(id: number, modelId: number, requesterId: number, status: string, createdAt: string): Row {
  return {
    id,
    modelId,
    requesterId,
    fromNode: 'A',
    toNode: 'B',
    newWeight: '5.0000',
    status,
    rejectionReason: null,
    resultingVersionId: null,
    createdAt: new Date(createdAt),
    decidedAt: null,
  };
}

/** Il modello 1 è dell'utente 2, il modello 2 dell'utente 3. */
const table: Row[] = [
  row(1, 1, 4, 'pending', '2026-10-07T00:00:00.000Z'),
  row(2, 1, 2, 'approved', '2026-10-07T23:59:59.999Z'),
  row(3, 1, 4, 'rejected', '2026-10-08T00:00:00.000Z'),
  row(4, 2, 2, 'pending', '2026-10-07T12:00:00.000Z'),
  row(5, 2, 4, 'pending', '2026-10-07T13:00:00.000Z'),
  row(6, 1, 2, 'pending', '2026-10-07T12:00:00.000Z'),
];
const owners: Record<number, number[]> = { 2: [1], 3: [2], 9: [] };

beforeEach(() => {
  jest.restoreAllMocks();
  users.findById.mockResolvedValue({ tokens: '50.00' } as User);
});

describe('WeightRequestDao.search: clausola where', () => {
  const owned = { requesterId: 2, ownedModelIds: [1, 5] };
  const visibility = { [Op.or]: [{ requesterId: 2 }, { modelId: { [Op.in]: [1, 5] } }] };

  function lastQuery(spy: jest.SpyInstance): { where: Where; order: unknown } {
    return spy.mock.calls[0][0] as { where: Where; order: unknown };
  }

  it('nessun filtro: solo la visibilità', async () => {
    const spy = jest.spyOn(WeightChangeRequest, 'findAll').mockResolvedValue([]);
    await WeightRequestDao.search(owned);
    expect(lastQuery(spy).where).toEqual({ [Op.and]: [visibility] });
  });

  it('un filtro: modello, stato o giorno', async () => {
    const spy = jest.spyOn(WeightChangeRequest, 'findAll').mockResolvedValue([]);
    await WeightRequestDao.search({ ...owned, modelId: 1 });
    await WeightRequestDao.search({ ...owned, status: 'pending' });
    const day = dayRange('2026-10-07');
    await WeightRequestDao.search({ ...owned, day });
    const wheres = spy.mock.calls.map((c) => (c[0] as { where: Where }).where);
    expect(wheres[0]).toEqual({ [Op.and]: [visibility, { modelId: 1 }] });
    expect(wheres[1]).toEqual({ [Op.and]: [visibility, { status: 'pending' }] });
    expect(wheres[2]).toEqual({
      [Op.and]: [visibility, { createdAt: { [Op.gte]: day.start, [Op.lt]: day.end } }],
    });
  });

  it('tutti e tre i filtri insieme, in AND', async () => {
    const spy = jest.spyOn(WeightChangeRequest, 'findAll').mockResolvedValue([]);
    const day = dayRange('2026-10-07');
    await WeightRequestDao.search({ ...owned, modelId: 1, status: 'approved', day });
    expect(lastQuery(spy).where).toEqual({
      [Op.and]: [
        visibility,
        { modelId: 1 },
        { status: 'approved' },
        { createdAt: { [Op.gte]: day.start, [Op.lt]: day.end } },
      ],
    });
  });

  it('IN con lista vuota quando l\'utente non possiede modelli', async () => {
    const spy = jest.spyOn(WeightChangeRequest, 'findAll').mockResolvedValue([]);
    await WeightRequestDao.search({ requesterId: 9, ownedModelIds: [] });
    expect(lastQuery(spy).where).toEqual({
      [Op.and]: [{ [Op.or]: [{ requesterId: 9 }, { modelId: { [Op.in]: [] } }] }],
    });
  });

  it('ordinamento createdAt DESC, id DESC', async () => {
    const spy = jest.spyOn(WeightChangeRequest, 'findAll').mockResolvedValue([]);
    await WeightRequestDao.search(owned);
    expect(lastQuery(spy).order).toEqual([
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ]);
  });
});

describe('GET /weight-requests: risultato su dati in memoria', () => {
  beforeEach(() => {
    jest.spyOn(ModelDao, 'findIdsByOwner').mockImplementation(async (id) => owners[id] ?? []);
    jest.spyOn(WeightChangeRequest, 'findAll').mockImplementation((async (options?: { where: Where; order: [string, string][] }) => {
      const found = table.filter((r) => matches(r, options?.where ?? {}));
      return found.sort((a, b) => {
        for (const [field, dir] of options?.order ?? []) {
          const x = a[field] as Date | number;
          const y = b[field] as Date | number;
          if (x < y) return dir === 'DESC' ? 1 : -1;
          if (x > y) return dir === 'DESC' ? -1 : 1;
        }
        return 0;
      });
    }) as unknown as typeof WeightChangeRequest.findAll);
  });

  async function ids(userId: number, query = ''): Promise<number[]> {
    const res = await request(app).get(`/weight-requests${query}`).set('Authorization', asUser(userId)).expect(200);
    return (res.body.requests as { id: number }[]).map((r) => r.id);
  }

  it('visibilità: richieste inviate dall\'utente e richieste sui suoi modelli, non quelle di altri', async () => {
    // utente 2: invia 2, 4, 6 e possiede il modello 1 (richieste 1, 2, 3, 6); la 5 è di altri su un modello altrui
    expect(await ids(2)).toEqual([3, 2, 6, 4, 1]);
    // utente 3: possiede il modello 2 (richieste 4, 5) e non ha inviato nulla
    expect(await ids(3)).toEqual([5, 4]);
    // utente 4: vede solo quelle che ha inviato (1, 3, 5), non possiede modelli
    expect(await ids(4)).toEqual([3, 5, 1]);
    // utente 9: nessuna richiesta inviata e nessun modello
    expect(await ids(9)).toEqual([]);
  });

  it('ordinamento: più recenti prima, a parità di data id decrescente', async () => {
    const order = await ids(2);
    expect(order.indexOf(6)).toBeLessThan(order.indexOf(4));
  });

  it('filtri singoli e combinati', async () => {
    expect(await ids(2, '?modelId=2')).toEqual([4]);
    expect(await ids(2, '?status=pending')).toEqual([6, 4, 1]);
    expect(await ids(2, '?modelId=1&status=pending')).toEqual([6, 1]);
    expect(await ids(2, '?modelId=1&status=approved&date=2026-10-07')).toEqual([2]);
    expect(await ids(2, '?modelId=2&status=approved')).toEqual([]);
  });

  it('giorno di bordo: inizio incluso, fine esclusa', async () => {
    // la richiesta 1 è a 00:00:00.000 del 7 (inclusa), la 2 a 23:59:59.999 (inclusa), la 3 a 00:00 dell'8 (esclusa)
    expect(await ids(2, '?date=2026-10-07')).toEqual([2, 6, 4, 1]);
    expect(await ids(2, '?date=2026-10-08')).toEqual([3]);
    expect(await ids(2, '?date=2026-10-06')).toEqual([]);
  });

  it('modelId=01 equivale a modelId=1', async () => {
    expect(await ids(2, '?modelId=01')).toEqual(await ids(2, '?modelId=1'));
  });

  it.each(['?status=', '?status=pending&status=approved', '?modelId=1&modelId=2', '?date=2026-10-07&date=2026-10-08'])(
    '400 per %s',
    async (q) => {
      await request(app).get(`/weight-requests${q}`).set('Authorization', asUser(2)).expect(400);
    },
  );
});

describe('date di calendario', () => {
  it('2024-02-29 (bisestile) è valida, 2026-02-29 no', () => {
    expect(requestsQuerySchema.safeParse({ date: '2024-02-29' }).success).toBe(true);
    expect(requestsQuerySchema.safeParse({ date: '2026-02-29' }).success).toBe(false);
    expect(versionsQuerySchema.safeParse({ date: '2024-02-29' }).success).toBe(true);
    expect(versionsQuerySchema.safeParse({ date: '2026-02-29' }).success).toBe(false);
  });

  it('il giorno copre [inizio, fine) senza includere la fine', () => {
    const { start, end } = dayRange('2024-02-29');
    expect(start.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(end.toISOString()).toBe('2024-03-01T00:00:00.000Z');
  });
});

describe('ModelDao.listVersions: filtri singoli', () => {
  const day = dayRange('2026-10-07');

  function whereOf(spy: jest.SpyInstance, call: number): { where: Where; order: unknown } {
    return spy.mock.calls[call][0] as { where: Where; order: unknown };
  }

  it('date da sola, nodes da solo, edges da solo', async () => {
    const spy = jest.spyOn(ModelVersion, 'findAll').mockResolvedValue([]);
    await ModelDao.listVersions(1, { day });
    await ModelDao.listVersions(1, { nodes: 12 });
    await ModelDao.listVersions(1, { edges: 18 });
    await ModelDao.listVersions(1, {});
    expect(whereOf(spy, 0).where).toEqual({
      [Op.and]: [{ modelId: 1 }, { createdAt: { [Op.gte]: day.start, [Op.lt]: day.end } }],
    });
    expect(whereOf(spy, 1).where).toEqual({ [Op.and]: [{ modelId: 1 }, { nodeCount: 12 }] });
    expect(whereOf(spy, 2).where).toEqual({ [Op.and]: [{ modelId: 1 }, { edgeCount: 18 }] });
    expect(whereOf(spy, 3).where).toEqual({ [Op.and]: [{ modelId: 1 }] });
  });

  it('nodes=0 e edges=0 sono filtri validi, non assenti', async () => {
    const spy = jest.spyOn(ModelVersion, 'findAll').mockResolvedValue([]);
    await ModelDao.listVersions(1, { nodes: 0, edges: 0 });
    expect(whereOf(spy, 0).where).toEqual({ [Op.and]: [{ modelId: 1 }, { nodeCount: 0 }, { edgeCount: 0 }] });
  });

  it('versioni in ordine crescente', async () => {
    const spy = jest.spyOn(ModelVersion, 'findAll').mockResolvedValue([]);
    await ModelDao.listVersions(1, {});
    expect((whereOf(spy, 0).order as unknown[])[0]).toEqual(['versionNumber', 'ASC']);
  });

  it.each([
    ['date', '?date=2026-10-07'],
    ['nodes', '?nodes=12'],
    ['edges', '?edges=18'],
  ])('GET /models/1/versions con il solo filtro %s risponde 200', async (_name, q) => {
    jest.spyOn(ModelDao, 'findById').mockResolvedValue({ id: 1 } as GraphModel);
    const spy = jest.spyOn(ModelVersion, 'findAll').mockResolvedValue([]);
    const res = await request(app).get(`/models/1/versions${q}`).set('Authorization', asUser(2)).expect(200);
    expect(res.body).toEqual({ modelId: 1, count: 0, versions: [] });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
