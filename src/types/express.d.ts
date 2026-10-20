import { Role } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      /** Dati dell'utente autenticato, impostati da authenticate */
      auth: { userId: number; role: Role };
    }
  }
}

export {};
