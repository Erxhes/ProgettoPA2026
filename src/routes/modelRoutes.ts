import { Router } from 'express';
import { ModelController } from '../controllers/ModelController';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody, validateParams } from '../middleware/validate';
import { createModelSchema, executeModelSchema, idParamSchema } from '../validators/modelSchemas';

/** Rotte sui modelli (authenticate e checkTokens sono applicati a monte). */
export const modelRoutes = Router();
modelRoutes.post('/', validateBody(createModelSchema), asyncHandler(ModelController.create));
modelRoutes.post(
  '/:id/execute',
  validateParams(idParamSchema),
  validateBody(executeModelSchema),
  asyncHandler(ModelController.execute),
);
