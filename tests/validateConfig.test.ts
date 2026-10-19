import { generateKeyPairSync } from 'crypto';
import { validateConfig } from '../src/config/validateConfig';

const rsaKey = generateKeyPairSync('rsa', {
  modulusLength: 2048,
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
});
