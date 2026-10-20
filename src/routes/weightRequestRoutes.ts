import { Router } from 'express';
import * as WeightRequestController from '../controllers/WeightRequestController';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { idParamSchema } from '../validators/modelSchemas';
import { requestsQuerySchema } from '../validators/querySchemas';
import { rejectWeightRequestSchema } from '../validators/requestSchemas';

/** Consultazione delle richieste e decisione sulle richieste di cambio peso (decide il proprietario del modello) */
export const weightRequestRoutes = Router();
weightRequestRoutes.get('/', validateQuery(requestsQuerySchema), asyncHandler(WeightRequestController.list));
weightRequestRoutes.patch('/:id/approve', validateParams(idParamSchema), asyncHandler(WeightRequestController.approve));
weightRequestRoutes.patch(
  '/:id/reject',
  validateParams(idParamSchema),
  validateBody(rejectWeightRequestSchema),
  asyncHandler(WeightRequestController.reject),
);
