import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

import { config } from "./src/config.js";
import { prisma } from "./src/db.js";
import { notFound, errorHandler } from "./src/middleware/error.js";
import { generalLimiter } from "./src/middleware/rateLimit.js";

// ── Route imports ─────────────────────────────────────────────────────────────
import authRoutes      from "./src/routes/auth.js";
import equipmentRoutes from "./src/routes/equipment.js";
import testRoutes      from "./src/routes/tests.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/api", generalLimiter);

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",      authRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/tests",     testRoutes);

// ── 404 + error handler ───────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`🚀 SubstationAI API  →  http://localhost:${config.port}`);
  console.log(`   Environment : ${config.nodeEnv}`);
});

const shutdown = async (signal) => {
  console.log(`\n${signal} received — shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log("DB disconnected. Bye 👋");
    process.exit(0);
  });
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

export default app;
