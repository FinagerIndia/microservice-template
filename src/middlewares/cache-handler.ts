import { Request, Response, NextFunction } from 'express';
import redis from '@/configs/db/redis';
import Respond from '@/lib/respond';
import logger from '@/configs/logger';

interface CacheOptions {
  duration?: number; // Cache duration in seconds
  key?: string | ((req: Request) => string); // Custom key or key generator
}

export const cache = (options: CacheOptions = {}) => {
  const { duration = 3600, key } = options; // Default 1 hour cache

  return async (req: Request, res: Response, next: NextFunction) => {
    // Generate cache key
    const cacheKey =
      typeof key === 'function'
        ? key(req)
        : key || `${req.method}:${req.originalUrl}`;

    try {
      // Check cache
      const cachedResponse = await redis.get(cacheKey);

      if (cachedResponse) {
        Respond(res, JSON.parse(cachedResponse), 200, true);
      }

      // Store original res.json method
      const originalJson = res.json;

      // Override res.json method to cache the response
      res.json = function (body): Response {
        redis
          .setex(cacheKey, duration, JSON.stringify(body))
          .catch((err) => logger.error('Cache error:', err));

        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      // If Redis fails, continue without caching
      logger.error('Cache error:', error);
      next();
    }
  };
};

// Helper to clear cache
export const clearCache = async (pattern: string): Promise<void> => {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
};