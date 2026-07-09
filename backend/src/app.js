import fs from 'fs';
import crypto from 'crypto';
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

/** В production отдаём собранный dist/ (docker/сервер), иначе исходники frontend/. */
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
  const frontendIndex = path.join(frontendRoot, 'index.html');

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
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'", 'data:'],
                fontSrc: ["'self'"],
                connectSrc: ["'self'"],
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
  app.use((req, res, next) => {
    const incoming = req.headers['x-request-id'];
    const requestId = typeof incoming === 'string' && incoming.trim() ? incoming.trim() : crypto.randomUUID();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => req.id,
      }),
    );
  }

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'test' ? 10_000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  app.use('/api', api);

  if (env.SERVE_FRONTEND) {
    app.use(express.static(frontendRoot));
  }

  app.use((req, res) => {
    if (req.path.startsWith('/api') || !env.SERVE_FRONTEND) {
      return res.status(404).json({ error: 'Not found' });
    }
    const isGetLike = req.method === 'GET' || req.method === 'HEAD';
    const hasFileExt = path.extname(req.path).length > 0;
    if (isGetLike && !hasFileExt && fs.existsSync(frontendIndex)) {
      return res.sendFile(frontendIndex);
    }
    return res.status(404).json({ error: 'Not found' });
  });

  // Keep JSON errors for API, nice page for frontend.
  app.use((err, req, res, next) => {
    return errorHandler(err, req, res, next);
  });

  return app;
}
