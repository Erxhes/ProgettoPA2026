import { Transaction } from 'sequelize';
import { UserDao } from '../dao/UserDao';
import { ErrorFactory } from '../errors/ErrorFactory';

/** Calcolo e addebito dei token */
export class TokenService {
  /** Costo in token di un modello: 0.20 per nodo + 0.01 per arco */
  static costFor(nodes: number, edges: number): number {
    return (nodes * 20 + edges) / 100;
  }

  /** Addebita `cost` token all'utente in modo atomico e restituisce il saldo residuo */
  static async charge(userId: number, cost: number, tx?: Transaction): Promise<number> {
    const remaining = await UserDao.deductTokens(userId, cost, tx);
    if (remaining === null) {
      // Si legge nella stessa transazione, per non aprire una seconda connessione dal pool
      const user = await UserDao.findById(userId, tx);
      const balance = user ? Number(user.tokens) : 0;
      // A saldo zero messaggio generico, altrimenti si indicano costo e saldo
      if (balance <= 0) throw ErrorFactory.insufficientTokens();
      throw ErrorFactory.insufficientTokens(
        `Token insufficienti: costo richiesto ${cost.toFixed(2)}, saldo ${balance.toFixed(2)}`,
      );
    }
    return remaining;
  }
}
