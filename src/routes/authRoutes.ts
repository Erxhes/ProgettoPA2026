import { Router } from 'express';
import * as AuthController from '../controllers/AuthController';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema } from '../validators/authSchemas';

/** Registrazione e login: rotte pubbliche, senza JWT (il token si ottiene proprio da qui). */
export const authRoutes = Router();
authRoutes.post('/register', validateBody(registerSchema), asyncHandler(AuthController.register));
authRoutes.post('/login', validateBody(loginSchema), asyncHandler(AuthController.login));
