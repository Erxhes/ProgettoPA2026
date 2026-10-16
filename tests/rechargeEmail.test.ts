import request from 'supertest';
import { createApp } from '../src/app';
import { UserDao } from '../src/dao/UserDao';
import { User } from '../src/models';
import { JwtService } from '../src/services/JwtService';

jest.mock('../src/dao/UserDao');
const dao = jest.mocked(UserDao);

const app = createApp();
const adminToken = `Bearer ${JwtService.sign({ userId: 1, role: 'admin' })}`;

function recharge(body: object): request.Test {
  return request(app).post('/admin/recharge').set('Authorization', adminToken).send(body);
}

describe('POST /admin/recharge: email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dao.findById.mockResolvedValue({ tokens: '10.00' } as User);
    dao.findByEmail.mockResolvedValue({ email: 'elena.greco@example.com', tokens: '1.00' } as User);
    dao.addTokens.mockResolvedValue({ email: 'elena.greco@example.com', tokens: '6.00' } as User);
  });

  it('toglie gli spazi e passa al DAO l\'email in minuscolo', async () => {
    await recharge({ email: '  Elena.GRECO@Example.COM ', credit: 5 }).expect(200);
    expect(dao.findByEmail).toHaveBeenCalledWith('elena.greco@example.com');
  });

  it('rifiuta ancora un\'email malformata', async () => {
    await recharge({ email: 'non-una-mail', credit: 5 }).expect(400);
  });
});
