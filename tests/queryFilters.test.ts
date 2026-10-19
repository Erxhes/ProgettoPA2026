import { Op } from 'sequelize';
import request from 'supertest';
import { createApp } from '../src/app';
import { ModelDao } from '../src/dao/ModelDao';
import { UserDao } from '../src/dao/UserDao';
import { User, WeightChangeRequest } from '../src/models';
import { JwtService } from '../src/services/JwtService';

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

  it('filtri singoli e combinati', async () => {
    expect(await ids(2, '?modelId=2')).toEqual([4]);
    expect(await ids(2, '?status=pending')).toEqual([6, 4, 1]);
    expect(await ids(2, '?modelId=1&status=pending')).toEqual([6, 1]);
    expect(await ids(2, '?modelId=1&status=approved&date=2026-10-07')).toEqual([2]);
    expect(await ids(2, '?modelId=2&status=approved')).toEqual([]);
  });
});
