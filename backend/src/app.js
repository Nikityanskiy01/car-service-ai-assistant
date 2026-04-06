import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
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
const frontendSrc = path.join(projectRoot, 'frontend');
const frontendDist = path.join(projectRoot, 'frontend', 'dist');

/** В production отдаём собранный dist/ (Render, docker), иначе исходники frontend/. */
function resolveFrontendRoot(env) {
  if (env.NODE_ENV === 'production' && fs.existsSync(frontendDist)) {
    return frontendDist;
  }
  return frontendSrc;
}

export function createApp() {
  const app = express();
  const env = getEnv();
  const frontendRoot = resolveFrontendRoot(env);
  const frontend404 = path.join(frontendRoot, '404.html');
  const frontend500 = path.join(frontendRoot, '500.html');

  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy:
        env.NODE_ENV === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", 'https://unpkg.com', 'https://api-maps.yandex.ru'],
                styleSrc: ["'self'", 'https://fonts.googleapis.com'],
                imgSrc: [
                  "'self'",
                  'data:',
                  'https://images.unsplash.com',
                  'https://*.yandex.net',
                  'https://*.yandex.ru',
                ],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                connectSrc: [
                  "'self'",
                  'https://api-maps.yandex.ru',
                  'https://suggest-maps.yandex.ru',
                  'https://geocode-maps.yandex.ru',
                  'https://*.maps.yandex.net',
                ],
                frameSrc: ["'none'"],
                workerSrc: ["'self'", 'blob:'],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
              },
            }
          : false,
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
  app.use(cookieParser());
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
