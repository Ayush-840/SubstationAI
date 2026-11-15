/**
 * requireRole(...roles) — must be used AFTER requireAuth.
 * Example: requireRole("ADMIN")  or  requireRole("ADMIN", "ENGINEER")
 */
export const requireRole = (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(" or ")}`,
      });
    }
    next();
  };

