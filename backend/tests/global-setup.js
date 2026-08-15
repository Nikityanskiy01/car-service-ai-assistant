import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertTestDatabaseUrl } from '../scripts/assert-test-database.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

export default async function globalSetup() {
  try {
    execSync('node scripts/ensure-test-database.mjs', { cwd: root, stdio: 'pipe' });
  } catch {
    /* optional */
  }

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-min-32-chars-long!!',
    DATABASE_URL:
      process.env.TEST_DATABASE_URL ||
      process.env.DATABASE_URL ||
      'postgresql://car_service_app:change-me@localhost:5433/car_service_test',
  };
  assertTestDatabaseUrl(env.DATABASE_URL);
  execSync('npx prisma migrate deploy', { cwd: root, env, stdio: 'pipe' });
}
