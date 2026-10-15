import { DataTypes, Model, Sequelize } from 'sequelize';

/** Modello di ottimizzazione su grafo, con un proprietario che decide sulle richieste di cambio peso. */
export class GraphModel extends Model {
  declare id: number;
  declare name: string;
  declare ownerId: number;

  /**
   * Definisce la tabella `models` (modelli di grafo) sull'istanza Sequelize condivisa.
   * @param sequelize istanza ottenuta da Database.getInstance()
   */
  static initModel(sequelize: Sequelize): void {
    GraphModel.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false },
        ownerId: { type: DataTypes.INTEGER, allowNull: false },
      },
      { sequelize, tableName: 'models', timestamps: false },
    );
  }
}
