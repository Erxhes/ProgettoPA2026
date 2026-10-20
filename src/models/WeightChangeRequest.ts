import { DataTypes, Model, Sequelize } from 'sequelize';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

/** Richiesta di cambio peso di un arco; il proprietario del modello la approva o la rifiuta */
export class WeightChangeRequest extends Model {
  declare id: number;
  declare modelId: number;
  declare requesterId: number;
  declare fromNode: string;
  declare toNode: string;
  declare newWeight: string;
  declare status: RequestStatus;
  declare rejectionReason: string | null;
  /** Versione creata dall'approvazione */
  declare resultingVersionId: number | null;
  declare createdAt: Date;
  declare decidedAt: Date | null;

  static initModel(sequelize: Sequelize): void {
    WeightChangeRequest.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        modelId: { type: DataTypes.INTEGER, allowNull: false },
        requesterId: { type: DataTypes.INTEGER, allowNull: false },
        fromNode: { type: DataTypes.STRING, allowNull: false },
        toNode: { type: DataTypes.STRING, allowNull: false },
        newWeight: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
        status: {
          type: DataTypes.ENUM('pending', 'approved', 'rejected'),
          allowNull: false,
          defaultValue: 'pending',
        },
        rejectionReason: { type: DataTypes.TEXT, allowNull: true },
        resultingVersionId: { type: DataTypes.INTEGER, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        decidedAt: { type: DataTypes.DATE, allowNull: true },
      },
      { sequelize, tableName: 'weight_change_requests', timestamps: false },
    );
  }
}
