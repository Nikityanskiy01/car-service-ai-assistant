/**
 * Из каталога backend: поднимает Postgres, создаёт тестовую БД, миграции, seed.
 * Требуется Docker и файл в корне репозитория `docker-compose.yml`.
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');
const repoRoot = path.join(backendRoot, '..');

execSync('docker compose up -d', { cwd: repoRoot, stdio: 'inherit' });
execSync('node scripts/ensure-test-database.mjs', { cwd: backendRoot, stdio: 'inherit' });
execSync('npx prisma migrate deploy', { cwd: backendRoot, stdio: 'inherit' });
execSync('npm run db:seed', { cwd: backendRoot, stdio: 'inherit' });
console.log('db-setup: готово. Запуск: npm run dev');
