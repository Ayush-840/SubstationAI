import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || "25", 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  adminEmail: process.env.ADMIN_EMAIL || "admin@substationai.com",
  adminPassword: process.env.ADMIN_PASSWORD || "Admin@1234",
};

// Fail fast if critical env vars are missing
if (!config.jwtSecret) {
  console.error("FATAL: JWT_SECRET is not set in .env");
  process.exit(1);
}

