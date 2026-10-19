import request from 'supertest';
import { createApp } from '../src/app';
import { UserDao } from '../src/dao/UserDao';
import { User } from '../src/models';
import { JwtService } from '../src/services/JwtService';

jest.mock('../src/dao/UserDao');
const dao = jest.mocked(UserDao);

const app = createApp();
const adminToken = `Bearer ${JwtService.sign({ userId: 1, role: 'admin' })}`;
const userToken = `Bearer ${JwtService.sign({ userId: 2, role: 'user' })}`;

describe('POST /admin/recharge', () => {
  beforeEach(() => {
    dao.findById.mockResolvedValue({ tokens: '10.00' } as User);
  });

  it('401 senza JWT', async () => {
    await request(app).post('/admin/recharge').send({ email: 'a@b.it', credit: 5 }).expect(401);
  });

  it('403 a un utente non admin', async () => {
    await request(app).post('/admin/recharge').set('Authorization', userToken).send({ email: 'a@b.it', credit: 5 }).expect(403);
  });

  it('400 con credito non valido', async () => {
    await request(app).post('/admin/recharge').set('Authorization', adminToken).send({ email: 'a@b.it', credit: -3 }).expect(400);
  });

  it('404 con email sconosciuta', async () => {
    dao.findByEmail.mockResolvedValue(null);
    await request(app).post('/admin/recharge').set('Authorization', adminToken).send({ email: 'x@y.it', credit: 5 }).expect(404);
  });

  it('200 e saldo aggiornato per l\'admin', async () => {
    const target = { email: 'elena.greco@example.com', tokens: '0.00' } as User;
    dao.findByEmail.mockResolvedValue(target);
    dao.addTokens.mockResolvedValue({ email: 'elena.greco@example.com', tokens: '25.00' } as User);
    const res = await request(app)
      .post('/admin/recharge')
      .set('Authorization', adminToken)
      .send({ email: 'elena.greco@example.com', credit: 25 })
      .expect(200);
    expect(res.body).toEqual({ email: 'elena.greco@example.com', tokens: 25 });
    expect(dao.addTokens).toHaveBeenCalledWith(target, 25);
  });
});
