import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createSession,
  listSessions,
  getSession,
  renameSession,
  deleteSession,
  chat,
} from "../controllers/chat.js";

const router = Router();

// All chat routes require authentication
router.use(requireAuth);

// ── Sessions ──────────────────────────────────────────────────────────────────
router.post("/sessions",       asyncHandler(createSession));
router.get("/sessions",        asyncHandler(listSessions));
router.get("/sessions/:id",    asyncHandler(getSession));
router.patch("/sessions/:id",  asyncHandler(renameSession));
router.delete("/sessions/:id", asyncHandler(deleteSession));

// ── Chat endpoint ─────────────────────────────────────────────────────────────
router.post("/", asyncHandler(chat));

export default router;
