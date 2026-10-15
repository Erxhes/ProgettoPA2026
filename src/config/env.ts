import dotenv from 'dotenv';
import { resolveAlpha } from './alpha';

dotenv.config({ quiet: true });

/**
 * Configurazione dell'applicazione, letta una sola volta dalle variabili d'ambiente.
 * La chiave privata RS256 arriva solo da .env (le newline possono essere scritte come "\n").
 */
export const env = {
  port: Number(process.env.PORT ?? 3000),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    name: process.env.DB_NAME ?? 'grafo',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
  },
  jwtPrivateKey: (process.env.JWT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  /** Coefficiente della media esponenziale, uguale per tutti i modelli (0 < alpha < 1, altrimenti 0.9). */
  alpha: resolveAlpha(process.env.ALPHA),
};
