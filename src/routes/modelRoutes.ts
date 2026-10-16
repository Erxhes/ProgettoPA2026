import { Router } from 'express';
import { ModelController } from '../controllers/ModelController';
import { WeightRequestController } from '../controllers/WeightRequestController';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { versionsQuerySchema } from '../validators/querySchemas';
import { createModelSchema, executeModelSchema, idParamSchema } from '../validators/modelSchemas';
import { createWeightRequestSchema } from '../validators/requestSchemas';

/** Rotte sui modelli (authenticate e checkTokens sono applicati a monte). */
export const modelRoutes = Router();
modelRoutes.post('/', validateBody(createModelSchema), asyncHandler(ModelController.create));
modelRoutes.post(
  '/:id/execute',
  validateParams(idParamSchema),
  validateBody(executeModelSchema),
  asyncHandler(ModelController.execute),
);
modelRoutes.get(
  '/:id/versions',
  validateParams(idParamSchema),
  validateQuery(versionsQuerySchema),
  asyncHandler(ModelController.versions),
);
modelRoutes.post(
  '/:id/weight-requests',
  validateParams(idParamSchema),
  validateBody(createWeightRequestSchema),
  asyncHandler(WeightRequestController.create),
);
