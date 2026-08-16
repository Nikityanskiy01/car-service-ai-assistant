import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/authJwt.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { contentDisposition, isInlineSafeImage } from '../../lib/fileMagic.js';
import * as requestMessagesService from './requestMessages.service.js';

const attachmentSchema = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120),
  contentBase64: z.string().min(1).max(6_000_000),
});

const postSchema = z
  .object({
    body: z.string().max(4000).optional().default(''),
    attachments: z.array(attachmentSchema).max(5).optional().default([]),
  })
  .refine((v) => v.body.trim().length > 0 || v.attachments.length > 0, {
    message: 'Укажите текст или прикрепите файл',
  });

function serializeMessage(m) {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    author: m.author,
    attachments: m.attachments,
    deliveryStatus: m.deliveryStatus ?? null,
  };
}

export const requestMessagesRouter = Router({ mergeParams: true });
requestMessagesRouter.use(authJwt);

requestMessagesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await requestMessagesService.listMessages(req.params.requestId, req.user);
    res.json(list.map(serializeMessage));
  }),
);

requestMessagesRouter.post(
  '/',
  validateBody(postSchema),
  asyncHandler(async (req, res) => {
    const m = await requestMessagesService.postMessage(
      req.params.requestId,
      req.user,
      req.validatedBody,
    );
    res.status(201).json(serializeMessage(m));
  }),
);

requestMessagesRouter.get(
  '/:messageId/attachments/:attachmentId',
  asyncHandler(async (req, res) => {
    const file = await requestMessagesService.getAttachment(
      req.params.requestId,
      req.params.messageId,
      req.params.attachmentId,
      req.user,
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', contentDisposition(file.fileName, { inline: isInlineSafeImage(file.mimeType) }));
    res.send(file.buffer);
  }),
);
