import { Transaction } from 'sequelize';
import { UserDao } from '../dao/UserDao';
import { ErrorFactory } from '../errors/ErrorFactory';

/** Calcolo e addebito dei token. */
export class TokenService {
  /**
   * Costo in token di un modello: 0.20 per nodo + 0.01 per arco.
   * Il calcolo è in centesimi interi per evitare errori di virgola mobile.
   */
  static costFor(nodes: number, edges: number): number {
    return (nodes * 20 + edges) / 100;
  }

  /**
   * Addebita `cost` token all'utente in modo atomico e restituisce il saldo residuo.
   * @throws INSUFFICIENT_TOKENS (401) se il saldo non basta
   */
  static async charge(userId: number, cost: number, tx?: Transaction): Promise<number> {
    const remaining = await UserDao.deductTokens(userId, cost, tx);
    if (remaining === null) {
      // Stessa transazione dell'addebito: una seconda connessione dal pool, con molte richieste insieme, lo esaurirebbe
      const user = await UserDao.findById(userId, tx);
      const balance = user ? Number(user.tokens) : 0;
      // Saldo a zero: messaggio generico; saldo positivo ma sotto il costo: indica costo e saldo
      if (balance <= 0) throw ErrorFactory.insufficientTokens();
      throw ErrorFactory.insufficientTokens(
        `Token insufficienti: costo richiesto ${cost.toFixed(2)}, saldo ${balance.toFixed(2)}`,
      );
    }
    return remaining;
  }
}
