import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import {
  getTest,
  searchTests,
  createTest,
  updateTest,
  deleteTest,
} from "../controllers/tests.js";

const router = Router();

router.use(requireAuth);

// ── Read (any logged-in user) ─────────────────────────────────────────────────
router.get("/", asyncHandler(searchTests));        // GET /api/tests?search=IR
router.get("/:id", asyncHandler(getTest));         // GET /api/tests/:id

// ── Write (ADMIN only) ────────────────────────────────────────────────────────
router.post("/", requireRole("ADMIN"), asyncHandler(createTest));
router.put("/:id", requireRole("ADMIN"), asyncHandler(updateTest));
router.delete("/:id", requireRole("ADMIN"), asyncHandler(deleteTest));

export default router;

