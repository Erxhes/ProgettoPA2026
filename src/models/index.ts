import { Database } from '../config/database';
import { Edge } from './Edge';
import { GraphModel } from './GraphModel';
import { ModelVersion } from './ModelVersion';
import { User } from './User';
import { WeightChangeRequest } from './WeightChangeRequest';

const sequelize = Database.getInstance();

User.initModel(sequelize);
GraphModel.initModel(sequelize);
ModelVersion.initModel(sequelize);
Edge.initModel(sequelize);
WeightChangeRequest.initModel(sequelize);

User.hasMany(GraphModel, { foreignKey: 'ownerId', as: 'models' });
GraphModel.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

GraphModel.hasMany(ModelVersion, { foreignKey: 'modelId', as: 'versions' });
ModelVersion.belongsTo(GraphModel, { foreignKey: 'modelId', as: 'model' });

ModelVersion.hasMany(Edge, { foreignKey: 'versionId', as: 'edges' });
Edge.belongsTo(ModelVersion, { foreignKey: 'versionId', as: 'version' });

GraphModel.hasMany(WeightChangeRequest, { foreignKey: 'modelId', as: 'requests' });
WeightChangeRequest.belongsTo(GraphModel, { foreignKey: 'modelId', as: 'model' });

User.hasMany(WeightChangeRequest, { foreignKey: 'requesterId', as: 'requests' });
WeightChangeRequest.belongsTo(User, { foreignKey: 'requesterId', as: 'requester' });

export { User, GraphModel, ModelVersion, Edge, WeightChangeRequest };
