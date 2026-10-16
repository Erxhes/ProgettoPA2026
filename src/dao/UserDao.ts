import { Transaction } from 'sequelize';
import { Database } from '../config/database';
import { User } from '../models';

/** Accesso ai dati degli utenti. */
export class UserDao {
  /** Cerca un utente per id, o null se non esiste. */
  static findById(id: number): Promise<User | null> {
    return User.findByPk(id);
  }

  /** Cerca un utente per email, o null se non esiste. */
  static findByEmail(email: string): Promise<User | null> {
    return User.findOne({ where: { email } });
  }

  /** Somma `amount` al saldo con un incremento atomico e restituisce l'utente aggiornato. */
  static async addTokens(user: User, amount: number): Promise<User> {
    await user.increment('tokens', { by: amount });
    return user.reload();
  }

  /**
   * Sottrae `amount` dal saldo solo se è sufficiente (un'unica UPDATE condizionata, senza corse tra richieste).
   * @returns il saldo residuo, oppure null se il saldo non basta
   */
  static async deductTokens(userId: number, amount: number, tx?: Transaction): Promise<number | null> {
    const [rows] = await Database.getInstance().query(
      'UPDATE users SET tokens = tokens - :amount WHERE id = :id AND tokens >= :amount RETURNING tokens',
      { replacements: { amount: amount.toFixed(2), id: userId }, transaction: tx },
    );
    const updated = rows as { tokens: string }[];
    return updated.length === 0 ? null : Number(updated[0].tokens);
  }
}
