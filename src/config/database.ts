import { Sequelize } from 'sequelize';
import { env } from './env';

/** Singleton della connessione al database: tutta l'applicazione condivide una sola istanza Sequelize */
export class Database {
  private static instance: Sequelize | undefined;

  private constructor() {}

  /** Restituisce l'istanza Sequelize, creandola alla prima chiamata */
  static getInstance(): Sequelize {
    if (!Database.instance) {
      Database.instance = new Sequelize(env.db.name, env.db.user, env.db.password, {
        host: env.db.host,
        port: env.db.port,
        dialect: 'postgres',
        logging: false,
      });
    }
    return Database.instance;
  }
}
