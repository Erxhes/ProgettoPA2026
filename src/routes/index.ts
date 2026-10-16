import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { checkTokens } from '../middleware/checkTokens';
import { adminRoutes } from './adminRoutes';
import { modelRoutes } from './modelRoutes';

/** Router principale: tutte le rotte passano da JWT e controllo dei token residui. */
export const apiRouter = Router();
apiRouter.use(authenticate, checkTokens);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/models', modelRoutes);
