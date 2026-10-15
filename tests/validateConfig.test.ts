import { generateKeyPairSync } from 'crypto';
import { validateConfig } from '../src/config/validateConfig';

const rsaKey = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
}).privateKey;

const ecKey = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
}).privateKey;

const valid = { port: 3000, db: { port: 5432 }, jwtPrivateKey: rsaKey };

describe('validateConfig', () => {
  it('accetta una configurazione valida', () => {
    expect(() => validateConfig(valid)).not.toThrow();
  });

  it('rifiuta una chiave JWT vuota', () => {
    expect(() => validateConfig({ ...valid, jwtPrivateKey: '' })).toThrow(/JWT_PRIVATE_KEY/);
  });

  it('rifiuta una chiave JWT non PEM', () => {
    expect(() => validateConfig({ ...valid, jwtPrivateKey: 'non-una-chiave' })).toThrow(/JWT_PRIVATE_KEY/);
  });

  it('rifiuta una chiave che non è RSA (RS256 la richiede)', () => {
    expect(() => validateConfig({ ...valid, jwtPrivateKey: ecKey })).toThrow(/RSA/);
  });

  it.each([NaN, 0, -1, 70000, 3000.5])('rifiuta PORT non valida (%p)', (port) => {
    expect(() => validateConfig({ ...valid, port })).toThrow(/PORT/);
  });

  it.each([NaN, 0, 65536])('rifiuta DB_PORT non valida (%p)', (port) => {
    expect(() => validateConfig({ ...valid, db: { port } })).toThrow(/DB_PORT/);
  });
});
