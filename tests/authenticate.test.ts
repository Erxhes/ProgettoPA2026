import { createPublicKey, generateKeyPairSync } from 'crypto';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';
import { AppError } from '../src/errors/AppError';
import { authenticate } from '../src/middleware/authenticate';
import { JwtService } from '../src/services/JwtService';

/** Esegue il middleware e restituisce ciò che ha passato a next(). */
function run(authorization?: string): { req: Request; err: unknown } {
  const req = { headers: { authorization } } as Request;
  let err: unknown;
  authenticate(req, {} as Response, (e?: unknown) => {
    err = e;
  });
  return { req, err };
}

describe('authenticate', () => {
  it('accetta un token RS256 valido e imposta req.auth', () => {
    const { req, err } = run(`Bearer ${JwtService.sign({ userId: 7, role: 'admin' })}`);
    expect(err).toBeUndefined();
    expect(req.auth).toEqual({ userId: 7, role: 'admin' });
  });

  it('risponde 401 se manca il token', () => {
    const { err } = run(undefined);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(401);
  });

  it('risponde 401 se il token è firmato con un\'altra chiave', () => {
    const other = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    }).privateKey;
    const token = JwtService.sign({ userId: 1, role: 'user' }, other);
    expect((run(`Bearer ${token}`).err as AppError).status).toBe(401);
  });

  it('risponde 401 se il token è scaduto', () => {
    const token = JwtService.sign({ userId: 1, role: 'user' }, undefined, -10);
    expect((run(`Bearer ${token}`).err as AppError).status).toBe(401);
  });

  it('risponde 401 a un token HS256 firmato con la chiave pubblica (algorithm confusion)', () => {
    const publicKey = createPublicKey(env.jwtPrivateKey).export({ type: 'spki', format: 'pem' }) as string;
    const token = jwt.sign({ role: 'admin' }, publicKey, { algorithm: 'HS256', subject: '1' });
    expect((run(`Bearer ${token}`).err as AppError).status).toBe(401);
  });
});
