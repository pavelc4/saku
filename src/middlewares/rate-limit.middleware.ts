import { Context, Next } from "hono";

export function rateLimit(endpointName: string, maxRequests: number) {
  return async (c: Context, next: Next) => {
    const env = c.env as any;
    
    // Attempt to get client IP
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown-ip";
    const key = `rl:${endpointName}:${ip}`;

    try {
      const currentVal = await env.SESSION_KV.get(key);
      let count = currentVal ? parseInt(currentVal, 10) : 0;

      if (count >= maxRequests) {
        return c.json(
          {
            success: false,
            error: "TOO_MANY_REQUESTS",
            message: "You have exceeded the allowed rate limit.",
          },
          429
        );
      }

      // Increment count and put back into KV
      // Use relatively short TTL (60s window)
      // Note: KV is eventually consistent, this is a "best effort" limit
      count++;
      await env.SESSION_KV.put(key, count.toString(), { expirationTtl: 60 });
      
    } catch (e) {
      // If KV fails, we log it but don't strictly block to avoid total outage
      console.error(`Rate Limiter error for key ${key}:`, e);
    }

    await next();
  };
}
