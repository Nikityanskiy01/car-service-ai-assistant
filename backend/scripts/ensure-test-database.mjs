/**
 * Создаёт БД foxmotors_test в локальном Postgres (Docker), если её ещё нет.
 * Нужна для Jest (TEST_DATABASE_URL).
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');

try {
  execSync(
    'docker compose exec -T db psql -U fox -d postgres -c "CREATE DATABASE foxmotors_test;"',
    { cwd: repoRoot, stdio: 'pipe' },
  );
  console.log('ensure-test-database: created foxmotors_test');
} catch {
  /* уже есть или Docker недоступен */
}
