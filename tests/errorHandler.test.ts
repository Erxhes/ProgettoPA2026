import express, { Express } from 'express';
import request from 'supertest';
import { ErrorFactory } from '../src/errors/ErrorFactory';
import { errorHandler } from '../src/middleware/errorHandler';

/** App minima con tre rotte che sollevano errori diversi. */
function buildApp(): Express {
  const app = express();
  app.get('/app-error', (_req, _res, next) => next(ErrorFactory.conflict('già deciso')));
  app.get('/unexpected', (_req, _res, next) => next(new Error('password del db: segreta')));
  app.get('/factory/:kind', (req, _res, next) => {
    const errors = {
      unauthorized: ErrorFactory.unauthorized(),
      tokens: ErrorFactory.insufficientTokens(),
      forbidden: ErrorFactory.forbidden(),
      bad: ErrorFactory.badRequest('x'),
      missing: ErrorFactory.notFound(),
    };
    next(errors[req.params.kind as keyof typeof errors]);
  });
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

  it.each([
    ['unauthorized', 401, 'UNAUTHORIZED'],
    ['tokens', 401, 'INSUFFICIENT_TOKENS'],
    ['forbidden', 403, 'FORBIDDEN'],
    ['bad', 400, 'BAD_REQUEST'],
    ['missing', 404, 'NOT_FOUND'],
  ])('ErrorFactory.%s -> %i %s', async (kind, status, code) => {
    const res = await request(buildApp()).get(`/factory/${kind}`).expect(status);
    expect(res.body.error.code).toBe(code);
  });
});
