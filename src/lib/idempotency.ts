import { getRedisClient } from "@/lib/redis";

export type JsonResult<T> = {
  status: number;
  body: T;
};

type CachedResponse = JsonResult<unknown> & {
  createdAt: string;
};

const responseTtlSeconds = 60 * 60 * 24;
const lockTtlSeconds = 60;

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function withIdempotency<T>(
  idempotencyKey: string,
  handler: () => Promise<JsonResult<T>>,
): Promise<JsonResult<T>> {
  const redis = getRedisClient();

  if (!redis) {
    return handler();
  }

  const cacheKey = `idem:${idempotencyKey}`;
  const lockKey = `${cacheKey}:lock`;
  const cached = await redis.get<CachedResponse>(cacheKey);

  if (cached) {
    return { status: cached.status, body: cached.body as T };
  }

  const acquired = await redis.set(lockKey, "1", {
    nx: true,
    ex: lockTtlSeconds,
  });

  if (!acquired) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await sleep(100);
      const existing = await redis.get<CachedResponse>(cacheKey);

      if (existing) {
        return { status: existing.status, body: existing.body as T };
      }
    }
  }

  try {
    const response = await handler();
    const payload: CachedResponse = {
      status: response.status,
      body: response.body,
      createdAt: new Date().toISOString(),
    };

    await redis.set(cacheKey, payload, { ex: responseTtlSeconds });

    return response;
  } finally {
    await redis.del(lockKey);
  }
}
