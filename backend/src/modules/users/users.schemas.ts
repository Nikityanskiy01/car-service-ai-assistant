import { z } from 'zod';
import { registerPasswordSchema } from '../../lib/passwordPolicy.js';

export const patchSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
  emailProfile: z.string().email().optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  telegram: z.string().max(64).optional().nullable(),
  preferredContact: z.enum(['PHONE', 'EMAIL', 'TELEGRAM']).optional().nullable(),
});

export const avatarSchema = z.object({
  mimeType: z.string().min(3).max(120),
  contentBase64: z.string().min(1).max(3_000_000),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: registerPasswordSchema,
});

export const totpConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Код должен содержать 6 цифр'),
});

export const totpVerifySchema = z.object({
  password: z.string().min(1),
  code: z.string().trim().min(6).max(20),
});

export const totpDisableSchema = totpVerifySchema.extend({
  confirmPhrase: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === 'УДАЛИТЬ', { message: 'Чтобы отключить защиту, введите слово УДАЛИТЬ' }),
});

export const phoneVerifyConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Код должен содержать 6 цифр'),
});

export const sessionRevokeStartSchema = z.object({
  scope: z.enum(['one', 'others']).default('others'),
  sessionId: z.string().uuid().optional(),
});

export const sessionRevokeConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Код должен содержать 6 цифр'),
});

export const loginMethodsSchema = z.object({
  loginEmailOtpEnabled: z.boolean().optional(),
  loginSmsEnabled: z.boolean().optional(),
  loginTelegramEnabled: z.boolean().optional(),
  password: z.string().min(1).optional(),
  code: z.string().trim().max(20).optional(),
});

export const notificationPrefsSchema = z.object({
  bookingReminders: z.boolean().optional(),
  messageAlerts: z.boolean().optional(),
  marketing: z.boolean().optional(),
  channelEmail: z.boolean().optional(),
  channelTelegram: z.boolean().optional(),
  channelSms: z.boolean().optional(),
});

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().uuid()).max(100).optional(),
});

export const sensitiveActionSchema = z.object({
  password: z.string().min(1),
  code: z.string().trim().max(20).optional(),
});
