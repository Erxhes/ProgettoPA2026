import request from 'supertest';
import { createApp } from '../src/app';
import { Database } from '../src/config/database';

describe('Database (Singleton)', () => {
  it('restituisce sempre la stessa istanza Sequelize', () => {
    expect(Database.getInstance()).toBe(Database.getInstance());
  });
});

describe('GET /health', () => {
  it('risponde 200 senza autenticazione', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
