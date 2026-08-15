import { PrismaClient } from '@prisma/client';
import { seedDemoInboxNotifications } from './lib/demoInboxNotifications.js';

const prisma = new PrismaClient();

const clientEmail = process.env.DEMO_CLIENT_EMAIL || 'client@example.local';

async function main() {
  const client = await prisma.user.findUnique({ where: { email: clientEmail } });
  if (!client) {
    throw new Error(`Демо-клиент не найден: ${clientEmail}. Сначала выполните npm run db:seed:demo`);
  }

  const bookings = await prisma.serviceBooking.findMany({
    where: { clientId: client.id },
    orderBy: { preferredAt: 'asc' },
    select: { id: true, status: true, preferredAt: true },
  });

  const requests = await prisma.serviceRequest.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });

  const count = await seedDemoInboxNotifications(prisma, {
    userId: client.id,
    bookings,
    requests,
  });

  const unread = await prisma.inboxNotification.count({
    where: { userId: client.id, readAt: null },
  });

  console.log(
    `Inbox demo seed OK for ${clientEmail}: ${count} notifications (${unread} непрочитанных)`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
