import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

/** 404 catcher — mount AFTER all routes */
export function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}

/**
 * Global error handler — must have exactly 4 params so Express recognises it.
 * Handles: ZodError, Prisma errors, Multer errors, custom err.status, fallback 500.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // ── Zod validation error → 400 ────────────────────────────────────────────
  if (err instanceof ZodError) {
    const messages = err.errors.map(
      (e) => `${e.path.length ? e.path.join(".") + ": " : ""}${e.message}`
    );
    return res.status(400).json({ error: messages.join("; ") });
  }

  // ── Prisma unique constraint violation → 409 ─────────────────────────────
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    const field = Array.isArray(err.meta?.target)
      ? err.meta.target.join(", ")
      : (err.meta?.target ?? "field");
    return res.status(409).json({
      error: `A record with that ${field} already exists`,
    });
  }

  // ── Prisma record not found → 404 ────────────────────────────────────────
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2025"
  ) {
    return res.status(404).json({ error: "Record not found" });
  }

  // ── Prisma foreign key / relation error → 400 ─────────────────────────────
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2003"
  ) {
    return res.status(400).json({ error: "Related record not found" });
  }

  // ── Multer: file too large ────────────────────────────────────────────────
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File too large" });
  }

  // ── Multer: wrong field name ──────────────────────────────────────────────
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      error: 'File must be sent in the "file" field of the multipart form',
    });
  }

  // ── Custom HTTP errors (err.status set by our code) ───────────────────────
  if (err.status && typeof err.status === "number") {
    return res.status(err.status).json({ error: err.message });
  }

  // ── Fallback 500 ─────────────────────────────────────────────────────────
  console.error("[ErrorHandler] Unhandled error:", err);
  res.status(500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
}
