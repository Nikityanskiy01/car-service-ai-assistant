import { AppError } from '../lib/errors.js';
import prisma from '../lib/prisma.js';

const MAX_GUEST_MESSAGES = 20;

export async function assertGuestMessageQuota(sessionId, actor) {
  if (actor?.kind !== 'guest') return;
  const count = await prisma.message.count({
    where: { sessionId, sender: 'USER' },
  });
  if (count >= MAX_GUEST_MESSAGES) {
    throw new AppError(429, 'Для гостевой консультации достигнут лимит сообщений. Зарегистрируйтесь, чтобы продолжить.', 'LLM_QUOTA');
  }
}

export { MAX_GUEST_MESSAGES };
