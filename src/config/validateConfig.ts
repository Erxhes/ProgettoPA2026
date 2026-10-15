import { createPrivateKey } from 'crypto';

/** Parte della configurazione che deve essere valida prima di avviare il server. */
export interface ConfigToValidate {
  port: number;
  db: { port: number };
  jwtPrivateKey: string;
}

/**
 * Controlla la configurazione all'avvio e solleva un errore con un messaggio chiaro
 * se le porte non sono interi tra 1 e 65535 o se la chiave JWT non è una chiave privata RSA valida.
 * @throws Error se la configurazione non è valida
 */
export function validateConfig(config: ConfigToValidate): void {
  assertPort('PORT', config.port);
  assertPort('DB_PORT', config.db.port);
  let keyType: string | undefined;
  try {
    keyType = createPrivateKey(config.jwtPrivateKey).asymmetricKeyType;
  } catch {
    throw new Error('JWT_PRIVATE_KEY mancante o non valida: serve una chiave privata RSA in formato PEM (vedi .env.example)');
  }
  if (keyType !== 'rsa') {
    throw new Error('JWT_PRIVATE_KEY deve essere una chiave RSA (algoritmo RS256)');
  }
}

/** Verifica che il valore sia un intero di porta valido. */
function assertPort(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} non valida: serve un intero tra 1 e 65535`);
  }
}
