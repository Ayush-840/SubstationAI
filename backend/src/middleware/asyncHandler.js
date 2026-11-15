/**
 * Wraps an async route handler so that any thrown error is forwarded to
 * Express's next(err) — no try/catch needed in controllers.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

