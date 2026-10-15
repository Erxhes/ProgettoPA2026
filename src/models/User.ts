import { DataTypes, Model, Sequelize } from 'sequelize';

export type Role = 'user' | 'admin';

/** Utente del sistema: ruolo e saldo di token sono salvati nel DB (non nel JWT). */
export class User extends Model {
  declare id: number;
  declare email: string;
  declare role: Role;
  /** DECIMAL: Sequelize/pg lo restituisce come stringa, convertire con Number(). */
  declare tokens: string;

  /**
   * Definisce la tabella `users` sull'istanza Sequelize condivisa.
   * @param sequelize istanza ottenuta da Database.getInstance()
   */
  static initModel(sequelize: Sequelize): void {
    User.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        email: { type: DataTypes.STRING, allowNull: false, unique: true },
        role: { type: DataTypes.ENUM('user', 'admin'), allowNull: false, defaultValue: 'user' },
        tokens: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      },
      { sequelize, tableName: 'users', timestamps: false },
    );
  }
}
