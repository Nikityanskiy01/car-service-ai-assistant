import IORedis from 'ioredis';
import { getEnv } from '../config/env.js';
import { logger } from './logger.js';

/** @type */
let client = null;

export function getRedisUrl() {
  return String(getEnv().REDIS_URL || '').trim() || null;
}

export function getRedis() {
  const url = getRedisUrl();
  if (!url) return null;
  if (!client) {
    client = new (IORedis as any)(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
    client.on('error', (err) => {
      logger.warn({ err }, 'redis error');
    });
  }
  return client;
}

export async function pingRedis() {
  const redis = getRedis();
  if (!redis) return false;
  const pong = await redis.ping();
  return pong === 'PONG';
}

export async function closeRedis() {
  if (!client) return;
  const current = client;
  client = null;
  try {
    await current.quit();
  } catch {
    current.disconnect();
  }
}
