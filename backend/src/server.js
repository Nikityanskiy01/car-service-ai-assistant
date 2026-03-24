import { getEnv } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';

const env = getEnv();
const app = createApp();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'server listening');
});
