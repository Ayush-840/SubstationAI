/**
 * Express middleware that validates req.body against a Zod schema.
 * Throws ZodError on failure — caught by the global errorHandler.
 */
export const validate = (schema) => (req, _res, next) => {
  schema.parse(req.body); // throws ZodError on failure
  next();
};

