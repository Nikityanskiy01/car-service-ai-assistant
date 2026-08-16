import type { RequestHandler, Router } from 'express';
import { optionalAuthJwt } from '../../middleware/authJwt.js';
import {
  consultationSessionAccess,
  blockStaffFromPosting,
} from '../../middleware/consultationAccess.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { isAppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import * as consultationsService from './consultations.service.js';
import { messageSchema } from './consultations.schemas.js';
import { serializeSessionDetail } from './consultations.serialize.js';

export function registerConsultationsStreamRoutes(
  consultationsRouter: Router,
  deps: { llmLimiter: RequestHandler; requireAbuseChallenge: RequestHandler },
) {
  consultationsRouter.post(
    '/:sessionId/messages/stream',
    deps.llmLimiter,
    optionalAuthJwt,
    deps.requireAbuseChallenge,
    consultationSessionAccess,
    blockStaffFromPosting,
    validateBody(messageSchema),
    asyncHandler(async (req, res) => {
      const startedAt = Date.now();
      const requestId = req.id || req.headers['x-request-id'] || null;
      const sessionId = req.params.sessionId;
      let closed = false;
      let firstProgressAt = null;

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const send = (event, data) => {
        if (closed || res.writableEnded || res.destroyed) return;
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        if (typeof res.flush === 'function') res.flush();
      };

      const heartbeat = setInterval(() => {
        send('heartbeat', { ts: Date.now() });
      }, 15_000);

      req.on('close', () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        logger.info(
          {
            requestId,
            sessionId,
            stage: 'sse_connection_closed',
            durationMs: Date.now() - startedAt,
          },
          'consultation stream closed',
        );
      });

      logger.info({ requestId, sessionId, stage: 'consultation_request_received' }, 'consultation stream received');
      send('connected', { sessionId, requestId });
      send('thinking', { phase: 'started' });

      try {
        logger.info({ requestId, sessionId, stage: 'llm_request_started' }, 'consultation processing started');
        const session = await consultationsService.postMessage(
          sessionId,
          req.consultationActor,
          req.validatedBody.content,
          (progress) => {
            if (!firstProgressAt) {
              firstProgressAt = Date.now();
              logger.info(
                {
                  requestId,
                  sessionId,
                  stage: 'llm_first_chunk_received',
                  durationMs: firstProgressAt - startedAt,
                },
                'consultation first progress received',
              );
            }
            send('progress', progress);
          },
        );
        logger.info(
          {
            requestId,
            sessionId,
            stage: 'llm_request_completed',
            durationMs: Date.now() - startedAt,
          },
          'consultation processing completed',
        );
        send('done', serializeSessionDetail(session));
        logger.info(
          {
            requestId,
            sessionId,
            stage: 'sse_result_sent',
            durationMs: Date.now() - startedAt,
          },
          'consultation stream result sent',
        );
      } catch (e) {
        logger.warn(
          {
            requestId,
            sessionId,
            stage: 'llm_request_failed',
            durationMs: Date.now() - startedAt,
            code: isAppError(e) ? e.code : null,
            message: e instanceof Error ? e.message : String(e),
          },
          'consultation stream failed',
        );
        if (isAppError(e) && (e.statusCode === 503 || e.code === 'LLM_ERROR')) {
          send('error', {
            message:
              'Сервис интеллектуального анализа временно недоступен. Вы можете сохранить обращение и передать его менеджеру.',
            code: 'LLM_ERROR',
          });
        } else {
          const safeMessage = 'Не удалось обработать сообщение. Попробуйте повторить отправку.';
          send('error', { message: safeMessage });
        }
      }

      clearInterval(heartbeat);
      res.end();
    }),
  );
}
