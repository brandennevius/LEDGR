type Bucket = {
  count: number;
  resetAt: number;
};

type CheckInput = {
  key: string;
  limit: number;
  windowMs: number;
};

type CheckResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const store = new Map<string, Bucket>();

export const checkRateLimit = ({
  key,
  limit,
  windowMs,
}: CheckInput): CheckResult => {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  store.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0 };
};
