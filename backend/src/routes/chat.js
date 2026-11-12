import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/rateLimit.js";
import {
  createSession,
  listSessions,
  getSession,
  renameSession,
  deleteSession,
  chat,
  chatStream,
} from "../controllers/chat.js";

const router = Router();

// All chat routes require authentication
router.use(requireAuth);

// ── Sessions ──────────────────────────────────────────────────────────────────
router.post("/sessions",          asyncHandler(createSession));
router.get("/sessions",           asyncHandler(listSessions));
router.get("/sessions/:id",       asyncHandler(getSession));
router.patch("/sessions/:id",     asyncHandler(renameSession));
router.delete("/sessions/:id",    asyncHandler(deleteSession));

// ── Chat endpoints (rate-limited) ─────────────────────────────────────────────
router.post("/",        chatLimiter, asyncHandler(chat));
router.post("/stream",  chatLimiter, asyncHandler(chatStream));

export default router;

