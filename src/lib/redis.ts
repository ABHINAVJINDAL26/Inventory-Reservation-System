import { Redis } from "@upstash/redis";

let cachedRedis: Redis | null = null;

export function getRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  if (!cachedRedis) {
    cachedRedis = new Redis({ url, token });
  }

  return cachedRedis;
}
