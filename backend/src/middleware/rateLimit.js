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
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
  
});

/** Chat limiter — 60 messages per 15 min per IP */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});

