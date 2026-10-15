import { DataTypes, Model, Sequelize } from 'sequelize';

/** Arco orientato di una versione; i nodi del grafo sono ricavati dagli archi. */
export class Edge extends Model {
  declare id: number;
  declare versionId: number;
  declare fromNode: string;
  declare toNode: string;
  /** DECIMAL: restituito come stringa, convertire con Number(). */
  declare weight: string;

  /**
   * Definisce la tabella `edges` (archi di una versione) sull'istanza Sequelize condivisa.
   * @param sequelize istanza ottenuta da Database.getInstance()
   */
  static initModel(sequelize: Sequelize): void {
    Edge.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        versionId: { type: DataTypes.INTEGER, allowNull: false },
        fromNode: { type: DataTypes.STRING, allowNull: false },
        toNode: { type: DataTypes.STRING, allowNull: false },
        weight: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
      },
      {
        sequelize,
        tableName: 'edges',
        timestamps: false,
        indexes: [{ unique: true, fields: ['versionId', 'fromNode', 'toNode'] }],
      },
    );
  }
}
