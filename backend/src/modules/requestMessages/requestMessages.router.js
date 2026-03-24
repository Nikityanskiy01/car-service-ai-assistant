import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import * as requestMessagesService from './requestMessages.service.js';

const postSchema = z.object({
  body: z.string().min(1),
});

export const requestMessagesRouter = Router({ mergeParams: true });
requestMessagesRouter.use(authJwt);

requestMessagesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await requestMessagesService.listMessages(req.params.requestId, req.user);
    res.json(
      list.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        author: m.author,
      })),
    );
  }),
);

requestMessagesRouter.post(
  '/',
  validateBody(postSchema),
  asyncHandler(async (req, res) => {
    const m = await requestMessagesService.postMessage(
      req.params.requestId,
      req.user,
      req.validatedBody.body,
    );
    res.status(201).json({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      author: m.author,
    });
  }),
);
