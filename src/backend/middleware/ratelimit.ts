import { Response, NextFunction } from "express";
import redisClient from "../config/redis";
import { AuthRequest } from "./auth";

const WINDOW_SIZE_SECONDS = 60; // 1 minute window
const MAX_REQUESTS = 10; // max 10 requests per minute per user

export const rateLimiter = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId!;
    const key = `rate_limit:${userId}`;

    // get current count
    const current = await redisClient.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= MAX_REQUESTS) {
      res.status(429).json({
        error: "Too many requests",
        retryAfter: WINDOW_SIZE_SECONDS,
      });
      return;
    }

    // increment count
    await redisClient.multi().incr(key).expire(key, WINDOW_SIZE_SECONDS).exec();

    // attach remaining requests to response headers
    res.setHeader("X-RateLimit-Limit", MAX_REQUESTS);
    res.setHeader("X-RateLimit-Remaining", MAX_REQUESTS - count - 1);

    next();
  } catch (err) {
    // if Redis fails, don't block the request
    console.error("Rate limiter error:", err);
    next();
  }
};
