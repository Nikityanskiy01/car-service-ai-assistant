import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

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
      'postgresql://fox:fox@localhost:5432/foxmotors_test',
  };
  try {
    execSync('npx prisma migrate reset --force --skip-seed', { cwd: root, env, stdio: 'pipe' });
  } catch (e) {
    console.warn('global-setup: prisma db setup failed', e.message);
  }
}
