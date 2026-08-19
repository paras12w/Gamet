import type { NextFunction, Request, Response } from "express";

// A minimal in-memory sliding-window rate limiter. Single-process deployment
// (one Node service on Railway) so in-memory state is fine - no need for a
// shared store like Redis.
export function rateLimit(windowMs: number, max: number) {
  const hits = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ error: "Too many requests - slow down and try again shortly." });
    }
    recent.push(now);
    hits.set(key, recent);

    // Periodically forget IPs with no recent activity so the map doesn't
    // grow unbounded over a long-running process.
    if (hits.size > 5000) {
      for (const [k, times] of hits) {
        if (times.every((t) => now - t >= windowMs)) hits.delete(k);
      }
    }
    next();
  };
}
