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

describe('POST /admin/recharge: decimali del credito', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dao.findById.mockResolvedValue({ tokens: '10.00' } as User);
    dao.findByEmail.mockResolvedValue({ email: 'a@b.it', tokens: '1.00' } as User);
    dao.addTokens.mockResolvedValue({ email: 'a@b.it', tokens: '2.00' } as User);
  });

  it.each([0.07, 1.1, 19.99, 0.01, 5, 999999.99, 1000000])('accetta il credito %p', async (credit) => {
    await recharge({ email: 'a@b.it', credit }).expect(200);
  });

  it.each([0.001, 5.123, 0.005, 1e-7, 19.999])('rifiuta il credito %p con più di 2 decimali', async (credit) => {
    const res = await recharge({ email: 'a@b.it', credit }).expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(dao.addTokens).not.toHaveBeenCalled();
  });
});
