import rateLimit from "express-rate-limit";
import { config } from "../config.js";

const json429 = (_req, res) =>
  res.status(429).json({ error: "Too many requests, please try again later" });

/** General API limiter */
export const generalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,  // default 15 min
  max: config.rateLimitMax,            // default 100
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});

/** Stricter limiter for auth routes */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
  message: { error: "Too many auth attempts, please try again in 15 minutes" },
});

/** Chat limiter — 60 messages per 15 min per IP */
export const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});

