import { env } from '../config/env.js';

export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const notFound = (req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });

export const errorHandler = (err, req, res, next) => {
  if (err.name === 'ZodError') {
    return res.status(422).json({
      error: {
        code: 'VALIDATION',
        message: err.issues.map((issue) => issue.message).join(', '),
      },
    });
  }
  if (err.code === '23505') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Already exists' } });
  }
  if (err.code === '23503') {
    return res
      .status(400)
      .json({ error: { code: 'INVALID_REFERENCE', message: 'Referenced record does not exist' } });
  }
  if (err.code === '22P02') {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid identifier' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
  }
  if (err.status) {
    return res.status(err.status).json({ error: { code: err.code || 'ERROR', message: err.message } });
  }
  console.error(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    },
  });
};
