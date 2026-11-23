import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { register, login, me, changePassword } from "../controllers/auth.js";

const router = Router();

// POST /api/auth/register
router.post("/register", authLimiter, asyncHandler(register));

// POST /api/auth/login
router.post("/login", authLimiter, asyncHandler(login));

// GET /api/auth/me
router.get("/me", requireAuth, asyncHandler(me));
router.patch("/password", requireAuth, asyncHandler(changePassword));

export default router;

