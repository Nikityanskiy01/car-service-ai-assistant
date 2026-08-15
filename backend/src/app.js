import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { context, trace } from '@opentelemetry/api';
import { getEnv } from './config/env.js';
import './lib/zodRu.js';
import { apiMessages } from './config/apiMessages.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createRateLimiter, isOperationalApiPath } from './middleware/rateLimitConfig.js';
import { logger } from './lib/logger.js';
import { httpMetricsMiddleware } from './lib/httpMetrics.js';
import { sendProblem } from './lib/problem.js';
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
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        // SSE / event streams must not be buffered by gzip
        if (String(req.path || '').includes('/stream')) return false;
        return compression.filter(req, res);
      },
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy:
        env.NODE_ENV === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                styleSrcAttr: ["'unsafe-inline'"],
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
  // development: любой origin (LAN). production/test: только явный CORS_ORIGIN (без fallback true).
  const corsOrigin =
    env.NODE_ENV === 'development'
      ? true
      : String(env.CORS_ORIGIN || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
  app.use(
    cors({
      origin: corsOrigin.length ? corsOrigin : false,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use((req, res, next) => {
    const span = trace.getSpan(context.active());
    const traceId = span?.spanContext().traceId;
    const requestId =
      traceId && traceId !== '00000000000000000000000000000000' ? traceId : crypto.randomUUID();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);
    if (req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });
  app.use(httpMetricsMiddleware);

  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => req.id,
        autoLogging: {
          ignore: (req) =>
            req.url === '/api/health' ||
            req.url === '/api/live' ||
            req.url === '/api/ready' ||
            req.url === '/api/metrics' ||
            req.url?.startsWith('/api/health?'),
        },
      }),
    );
  }

  const limiter = createRateLimiter({ max: 300, skip: isOperationalApiPath });
  app.use('/api/', limiter);

  app.use('/api', api);

  if (env.SERVE_FRONTEND) {
    app.use(express.static(frontendRoot));
  }

  app.use((req, res) => {
    if (req.path.startsWith('/api') || !env.SERVE_FRONTEND) {
      return sendProblem(res, { status: 404, detail: apiMessages.common.notFound, code: 'NOT_FOUND', instance: req.path });
    }
    const isGetLike = req.method === 'GET' || req.method === 'HEAD';
    const hasFileExt = path.extname(req.path).length > 0;
    if (isGetLike && !hasFileExt && fs.existsSync(frontendIndex)) {
      return res.sendFile(frontendIndex);
    }
    return sendProblem(res, { status: 404, detail: apiMessages.common.notFound, code: 'NOT_FOUND', instance: req.path });
  });

  // Keep JSON errors for API, nice page for frontend.
  app.use((err, req, res, next) => {
    return errorHandler(err, req, res, next);
  });

  return app;
}
