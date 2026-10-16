import express from 'express';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { apiRouter } from './routes';

/** Crea l'applicazione Express (separata dal listen per poterla testare). */
export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use(apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
