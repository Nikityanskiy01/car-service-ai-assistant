export function assertTestDatabaseUrl(rawUrl = process.env.DATABASE_URL) {
  if (!rawUrl) {
    throw new Error('Test database guard: DATABASE_URL is not set');
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(new URL(rawUrl).pathname.replace(/^\/+/, ''));
  } catch {
    throw new Error('Test database guard: DATABASE_URL is invalid');
  }

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Test database guard: refusing to run against "${databaseName}". The database name must end with "_test".`,
    );
  }

  return rawUrl;
}

export async function assertTestDatabaseConnection(prisma) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Test database guard: destructive test cleanup requires NODE_ENV=test');
  }

  const rows = await prisma.$queryRawUnsafe('SELECT current_database() AS name');
  const databaseName = String(rows?.[0]?.name || '');
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Test database guard: refusing destructive cleanup on "${databaseName}". The connected database must end with "_test".`,
    );
  }

  return databaseName;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  assertTestDatabaseUrl();
}
