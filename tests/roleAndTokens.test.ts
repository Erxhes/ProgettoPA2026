import { Request, Response } from 'express';
import { UserDao } from '../src/dao/UserDao';
import { AppError } from '../src/errors/AppError';
import { checkTokens } from '../src/middleware/checkTokens';
import { requireRole } from '../src/middleware/requireRole';
import { User } from '../src/models';

jest.mock('../src/dao/UserDao');
const findById = jest.mocked(UserDao.findById);

/** Esegue un middleware (anche asincrono) e restituisce ciò che ha passato a next(). */
async function run(mw: (req: Request, res: Response, next: (e?: unknown) => void) => unknown, req: Partial<Request>): Promise<unknown> {
  return new Promise((resolve) => {
    void mw(req as Request, {} as Response, (e?: unknown) => resolve(e));
  });
}

function user(tokens: string): User {
  return { tokens } as User;
}

describe('requireRole', () => {
  it('lascia passare il ruolo richiesto', async () => {
    expect(await run(requireRole('admin'), { auth: { userId: 1, role: 'admin' } })).toBeUndefined();
  });

  it('risponde 403 a un ruolo diverso', async () => {
    const err = await run(requireRole('admin'), { auth: { userId: 2, role: 'user' } });
    expect((err as AppError).status).toBe(403);
  });
});

describe('checkTokens', () => {
  const req = { auth: { userId: 5, role: 'user' as const } };

  it('lascia passare chi ha token residui', async () => {
    findById.mockResolvedValue(user('0.20'));
    expect(await run(checkTokens, req)).toBeUndefined();
  });

  it('risponde 401 a token finiti', async () => {
    findById.mockResolvedValue(user('0.00'));
    const err = await run(checkTokens, req);
    expect((err as AppError).status).toBe(401);
    expect((err as AppError).code).toBe('INSUFFICIENT_TOKENS');
  });
});
