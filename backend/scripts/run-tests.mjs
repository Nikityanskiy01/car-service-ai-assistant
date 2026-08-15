import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { assertTestDatabaseUrl } from './assert-test-database.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fallbackUrl = 'postgresql://car_service_app:change-me@localhost:5433/car_service_test';
const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || fallbackUrl;

assertTestDatabaseUrl(databaseUrl);

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
};

run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'migrate', 'deploy']);
run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'generate']);

const args = process.argv.slice(2);
if (args.length === 0) args.push('--runInBand');
run(process.execPath, ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', ...args]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
