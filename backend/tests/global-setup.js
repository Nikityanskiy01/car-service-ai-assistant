import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

export default async function globalSetup() {
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
    execSync('npx prisma migrate deploy', { cwd: root, env, stdio: 'pipe' });
  } catch (e) {
    console.warn('global-setup: migrate deploy failed (PostgreSQL running?)', e.message);
  }
}
