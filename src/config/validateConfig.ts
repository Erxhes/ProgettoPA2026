/** Controlla all'avvio che la chiave privata JWT sia presente */
export function validateConfig(config: { jwtPrivateKey: string }): void {
  if (!config.jwtPrivateKey.trim()) {
    throw new Error('JWT_PRIVATE_KEY mancante: serve una chiave privata RSA in formato PEM (vedi .env.example)');
  }
}
