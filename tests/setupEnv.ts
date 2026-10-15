import { generateKeyPairSync } from 'crypto';

/** Imposta una chiave RS256 di test prima che il modulo env venga caricato. */
process.env.JWT_PRIVATE_KEY = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
}).privateKey;
