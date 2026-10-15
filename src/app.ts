import express from 'express';

/** Crea l'applicazione Express (separata dal listen per poterla testare). */
export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  return app;
}
