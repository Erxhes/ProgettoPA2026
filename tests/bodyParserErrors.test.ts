import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('errori di lettura del body', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('JSON malformato senza token: 400 BAD_REQUEST', async () => {
    const res = await request(app).post('/admin/recharge').set('Content-Type', 'application/json').send('{"email":').expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(typeof res.body.error.message).toBe('string');
    expect(Object.keys(res.body)).toEqual(['error']);
  });

  it('body troppo grande senza token: 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await request(app)
      .post('/admin/recharge')
      .send({ email: 'a@b.it', credit: 5, pad: 'x'.repeat(200_000) })
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(Object.keys(res.body)).toEqual(['error']);
  });
});
