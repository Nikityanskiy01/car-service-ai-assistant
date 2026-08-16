import prisma from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';

export const CONSENT_POLICY_VERSION = '2026-08-15';

export async function recordConsentEvent({
  userId = null,
  subjectKey,
  purpose,
  ip = null,
  userAgent = null,
  policyVersion = CONSENT_POLICY_VERSION,
}: any) {
  const key = String(subjectKey || '').trim().slice(0, 190);
  if (!key || !purpose) {
    throw new AppError(500, 'Не удалось зафиксировать согласие', 'CONSENT_FAILED');
  }
  try {
    return await prisma.consentEvent.create({
      data: {
        userId: userId || null,
        subjectKey: key,
        purpose: String(purpose).slice(0, 80),
        policyVersion: String(policyVersion).slice(0, 40),
        ip: ip ? String(ip).slice(0, 64) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
      },
    });
  } catch (err) {
    logger.error({ err, purpose }, 'consent event persist failed');
    throw new AppError(503, 'Не удалось сохранить согласие на обработку данных', 'CONSENT_FAILED');
  }
}
