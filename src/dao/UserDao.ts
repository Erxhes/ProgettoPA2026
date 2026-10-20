import { Transaction } from 'sequelize';
import { Database } from '../config/database';
import { User } from '../models';

/** Query sugli utenti */
export class UserDao {
  /** Cerca un utente per id */
  static findById(id: number, tx?: Transaction): Promise<User | null> {
    return User.findByPk(id, { transaction: tx });
  }

  /** Cerca un utente per email */
  static findByEmail(email: string): Promise<User | null> {
    return User.findOne({ where: { email } });
  }

  /** Cerca un utente per username */
  static findByUsername(username: string): Promise<User | null> {
    return User.findOne({ where: { username } });
  }

  /** Crea un utente con ruolo `user`; `passwordHash` è la password già cifrata */
  static create(data: { email: string; username: string; passwordHash: string; tokens: number }): Promise<User> {
    return User.create({ ...data, role: 'user' });
  }

  /** Aggiunge `amount` al saldo e restituisce l'utente aggiornato */
  static async addTokens(user: User, amount: number): Promise<User> {
    await user.increment('tokens', { by: amount });
    return user.reload();
  }

  /** Toglie `amount` dal saldo solo se basta, con una UPDATE sola; restituisce il saldo rimasto o null */
  static async deductTokens(userId: number, amount: number, tx?: Transaction): Promise<number | null> {
    // la condizione tokens >= amount nella UPDATE evita che due richieste insieme portino il saldo sotto zero
    const [rows] = await Database.getInstance().query(
      'UPDATE users SET tokens = tokens - :amount WHERE id = :id AND tokens >= :amount RETURNING tokens',
      { replacements: { amount: amount.toFixed(2), id: userId }, transaction: tx },
    );
    const updated = rows as { tokens: string }[];
    return updated.length === 0 ? null : Number(updated[0].tokens);
  }
}
