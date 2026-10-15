import { DataTypes, Model, Sequelize } from 'sequelize';

/** Versione dei pesi di un modello: fotografia del grafo (archi, numero di nodi e di archi, data). */
export class ModelVersion extends Model {
  declare id: number;
  declare modelId: number;
  declare versionNumber: number;
  declare nodeCount: number;
  declare edgeCount: number;
  /** Data di modifica della versione. */
  declare createdAt: Date;

  /**
   * Definisce la tabella `model_versions` (versioni dei pesi) sull'istanza Sequelize condivisa.
   * @param sequelize istanza ottenuta da Database.getInstance()
   */
  static initModel(sequelize: Sequelize): void {
    ModelVersion.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        modelId: { type: DataTypes.INTEGER, allowNull: false },
        versionNumber: { type: DataTypes.INTEGER, allowNull: false },
        nodeCount: { type: DataTypes.INTEGER, allowNull: false },
        edgeCount: { type: DataTypes.INTEGER, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      },
      {
        sequelize,
        tableName: 'model_versions',
        timestamps: false,
        indexes: [{ unique: true, fields: ['modelId', 'versionNumber'] }],
      },
    );
  }
}
