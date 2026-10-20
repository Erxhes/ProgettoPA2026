import { UserDao } from '../dao/UserDao';
import { ErrorFactory } from '../errors/ErrorFactory';

/** Operazioni riservate all'amministratore */
export class AdminService {
  /** Ricarica un utente sommando `credit` al saldo attuale */
  static async recharge(email: string, credit: number): Promise<{ email: string; tokens: number }> {
    const user = await UserDao.findByEmail(email);
    if (!user) throw ErrorFactory.notFound('Utente non trovato');
    const updated = await UserDao.addTokens(user, credit);
    return { email: updated.email, tokens: Number(updated.tokens) };
  }
}
