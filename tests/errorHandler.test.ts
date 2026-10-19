import express, { Express } from 'express';
import request from 'supertest';
import { ErrorFactory } from '../src/errors/ErrorFactory';
import { errorHandler } from '../src/middleware/errorHandler';

/** App minima con due rotte che sollevano errori diversi. */
function buildApp(): Express {
  const app = express();
  app.get('/app-error', (_req, _res, next) => next(ErrorFactory.conflict('già deciso')));
  app.get('/unexpected', (_req, _res, next) => next(new Error('password del db: segreta')));
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('traduce un AppError in status e codice stabili', async () => {
    const res = await request(buildApp()).get('/app-error').expect(409);
    expect(res.body).toEqual({ error: { code: 'CONFLICT', message: 'già deciso' } });
  });

  it('risponde 500 generico a un errore imprevisto, senza esporne il messaggio', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(buildApp()).get('/unexpected').expect(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('segreta');
    jest.restoreAllMocks();
  });
});
