import { DataTypes, Model, Sequelize } from 'sequelize';

export type Role = 'user' | 'admin';

/** Utente del sistema: ruolo e saldo di token sono salvati nel DB (non nel JWT) */
export class User extends Model {
  declare id: number;
  declare email: string;
  declare username: string;
  /** Password cifrata con bcrypt: non va mai restituita nelle risposte */
  declare passwordHash: string;
  declare role: Role;
  /** DECIMAL: Sequelize/pg lo restituisce come stringa, convertire con Number() */
  declare tokens: string;

  /** Definisce la tabella delle utenti */
  static initModel(sequelize: Sequelize): void {
    User.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        email: { type: DataTypes.STRING, allowNull: false, unique: true },
        username: { type: DataTypes.STRING(20), allowNull: false, unique: true },
        passwordHash: { type: DataTypes.STRING(60), allowNull: false },
        role: { type: DataTypes.ENUM('user', 'admin'), allowNull: false, defaultValue: 'user' },
        tokens: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      },
      { sequelize, tableName: 'users', timestamps: false },
    );
  }
}
