import { Transaction } from 'sequelize';
import { UserDao } from '../src/dao/UserDao';
import { AppError } from '../src/errors/AppError';
import { User } from '../src/models';
import { TokenService } from '../src/services/TokenService';

jest.mock('../src/dao/UserDao');
const deductTokens = jest.mocked(UserDao.deductTokens);
const findById = jest.mocked(UserDao.findById);

const tx = { id: 'transazione-di-prova' } as unknown as Transaction;

beforeEach(() => {
  jest.resetAllMocks();
});

describe('TokenService.charge', () => {
  it('restituisce il saldo residuo quando il credito basta', async () => {
    deductTokens.mockResolvedValue(47.42);
    expect(await TokenService.charge(4, 2.58, tx)).toBe(47.42);
    expect(findById).not.toHaveBeenCalled();
  });

  it('con saldo insufficiente rilegge l\'utente nella stessa transazione dell\'addebito', async () => {
    deductTokens.mockResolvedValue(null);
    findById.mockResolvedValue({ tokens: '0.42' } as User);
    await expect(TokenService.charge(4, 2.58, tx)).rejects.toThrow(AppError);
    // Senza la transazione la lettura userebbe una seconda connessione del pool
    expect(findById).toHaveBeenCalledWith(4, tx);
  });
});
