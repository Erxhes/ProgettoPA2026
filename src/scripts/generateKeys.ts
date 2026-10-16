import { generateKeyPairSync } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';

/** Genera una coppia RSA in keys/ e stampa la riga JWT_PRIVATE_KEY da incollare in .env. */
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
mkdirSync('keys', { recursive: true });
writeFileSync('keys/private.pem', privateKey);
writeFileSync('keys/public.pem', publicKey);
console.log('Chiavi scritte in keys/ (ignorata da git). Incolla questa riga in .env:\n');
console.log(`JWT_PRIVATE_KEY="${privateKey.trim().replace(/\n/g, '\\n')}"`);
