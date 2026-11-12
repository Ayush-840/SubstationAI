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
import documentRoutes  from "./src/routes/documents.js";
import chatRoutes      from "./src/routes/chat.js";
// Batch 4+
// import adminRoutes  from "./src/routes/admin.js";

const app = express();
if (config.nodeEnv === "production") app.set("trust proxy", 1);

// ── Security + parsing ────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(morgan("dev"));
app.use("/api", generalLimiter);

// ── Health check (unauthenticated) ────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api/auth",      authRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/tests",     testRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chat",      chatRoutes);
// app.use("/api/admin",  adminRoutes);  // Batch 4

// ── 404 + global error handler ────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const recoverStuckDocuments = async () => prisma.document.updateMany({ where: { status: "PROCESSING" }, data: { status: "FAILED", error: "Server restarted during processing" } });

const server = app.listen(config.port, () => {
  recoverStuckDocuments().catch((err) => console.error("Document recovery failed:", err.message));
  console.log(`🚀 SubstationAI API  →  http://localhost:${config.port}`);
  console.log(`   Environment : ${config.nodeEnv}`);
  console.log(`   DB endpoint : ${process.env.DATABASE_URL?.split("@")[1] ?? "local"}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
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

