import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { getEnv } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './lib/logger.js';
import api from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');
const frontendRoot = path.join(projectRoot, 'frontend');
const frontend404 = path.join(frontendRoot, '404.html');
const frontend500 = path.join(frontendRoot, '500.html');

export function createApp() {
  const app = express();
  const env = getEnv();

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  // В development запросы с того же ПК по LAN-IP (192.168.x.x) иначе не проходят CORS при origin=localhost только
  const corsOrigin =
    env.NODE_ENV === 'development' ? true : env.CORS_ORIGIN || true;
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  if (env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger }));
  }

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'test' ? 10_000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  app.use('/api', api);

  app.use(express.static(frontendRoot));

  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(404).sendFile(frontend404);
  });

  // Keep JSON errors for API, nice page for frontend.
  app.use((err, req, res, next) => {
    if (req.path?.startsWith?.('/api')) return errorHandler(err, req, res, next);
    try {
      return res.status(500).sendFile(frontend500);
    } catch {
      return errorHandler(err, req, res, next);
    }
  });

  return app;
}
