import type { NextRequest } from "next/server";

import { getEnv } from "@/lib/config";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export function isRateLimited(request: NextRequest) {
  const limit = getEnv().MAX_REQUEST_PER_MINUTE;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }

  current.count += 1;
  buckets.set(key, current);

  return current.count > limit;
}
