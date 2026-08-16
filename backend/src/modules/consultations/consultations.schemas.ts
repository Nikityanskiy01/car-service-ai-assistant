import { z } from 'zod';

const photoSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  imageBase64: z.string().min(100).max(6_000_000),
});

const messageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const reportSchema = z.object({
  label: z.string().optional(),
});

const claimSchema = z.object({
  guestToken: z.string().min(16),
});

const guestRequestSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(6).max(40),
  email: z.string().email().optional().nullable(),
  consentPersonalData: z.literal(true, {
    errorMap: () => ({ message: 'Необходимо согласие на обработку персональных данных' }),
  }),
});

const staffSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(500),
  offset: z.coerce.number().int().min(0).optional().default(0),
  cursor: z.string().min(4).max(512).optional(),
});


export {
  photoSchema,
  messageSchema,
  reportSchema,
  claimSchema,
  guestRequestSchema,
  staffSessionsQuerySchema,
};
