import { ApiError } from "@/lib/api-utils";

type Bucket = { count: number; resetAt: number };

const globalBuckets = globalThis as unknown as {
  socialFlowRateLimits?: Map<string, Bucket>;
};

const buckets = globalBuckets.socialFlowRateLimits ?? new Map<string, Bucket>();
globalBuckets.socialFlowRateLimits = buckets;

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Small single-instance rate limiter suitable for the included one-app Docker
 * deployment. For multi-replica deployments replace this with Redis or an
 * edge/WAF limiter so all replicas share the same counters.
 */
export function assertRateLimit(
  req: Request,
  input: { namespace: string; limit: number; windowMs: number; discriminator?: string }
) {
  const now = Date.now();
  const suffix = input.discriminator?.trim().toLowerCase() || "_";
  const key = `${input.namespace}:${clientIp(req)}:${suffix}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + input.windowMs });
    return;
  }

  if (existing.count >= input.limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    throw ApiError.rateLimited("Too many requests. Try again later.", retryAfter);
  }
  existing.count += 1;
}
