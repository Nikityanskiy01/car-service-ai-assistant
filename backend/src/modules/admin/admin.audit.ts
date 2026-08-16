import prisma from '../../lib/prisma.js';

export async function writeAdminAudit(actorId, action, entityType, entityId, payloadJson) {
  await prisma.adminAuditEvent.create({
    data: { actorId: actorId || null, action, entityType, entityId, payloadJson },
  });
}
