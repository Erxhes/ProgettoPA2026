import { createApp } from './app';
import { Database } from './config/database';
import { env } from './config/env';
import { validateConfig } from './config/validateConfig';

/** Punto di ingresso: verifica la configurazione e la connessione al DB, poi avvia il server HTTP. */
async function main(): Promise<void> {
  validateConfig(env);
  await Database.getInstance().authenticate();
  console.log('Connessione al database riuscita');
  createApp().listen(env.port, () => console.log(`Server in ascolto sulla porta ${env.port}`));
}

main().catch((err: unknown) => {
  console.error('Avvio fallito:', err);
  process.exit(1);
});
