import { Transaction } from 'sequelize';
import { Database } from '../config/database';
import { User } from '../models';

/** Accesso ai dati degli utenti. */
export class UserDao {
  /** Cerca un utente per id, o null se non esiste. Con una transazione la lettura usa la sua stessa connessione. */
  static findById(id: number, tx?: Transaction): Promise<User | null> {
    return User.findByPk(id, { transaction: tx });
  }

  /** Cerca un utente per email, o null se non esiste. */
  static findByEmail(email: string): Promise<User | null> {
    return User.findOne({ where: { email } });
  }

  /** Cerca un utente per username, o null se non esiste. */
  static findByUsername(username: string): Promise<User | null> {
    return User.findOne({ where: { username } });
  }

  /** Crea un utente con ruolo `user`; `passwordHash` è la password già cifrata. */
  static create(data: { email: string; username: string; passwordHash: string; tokens: number }): Promise<User> {
    return User.create({ ...data, role: 'user' });
  }

  /** Somma `amount` al saldo con un incremento atomico e restituisce l'utente aggiornato. */
  static async addTokens(user: User, amount: number): Promise<User> {
    await user.increment('tokens', { by: amount });
    return user.reload();
  }

  /**
   * Sottrae `amount` dal saldo solo se è sufficiente (un'unica UPDATE condizionata, che funziona anche se arrivano più richieste insieme).
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
