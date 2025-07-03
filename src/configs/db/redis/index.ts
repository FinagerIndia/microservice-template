import Redis from 'ioredis';
import logger from '@/configs/logger';
import env from '@/env';

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
});

redis.on('error', (error) => {
  logger.error(`Redis error: ${error.message}`);
  throw error;
});

export default redis;