import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import {
  listEquipment,
  getEquipment,
  getEquipmentTests,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from "../controllers/equipment.js";

const router = Router();

// All equipment routes require authentication
router.use(requireAuth);

// ── Read (any logged-in user) ─────────────────────────────────────────────────
router.get("/", asyncHandler(listEquipment));
router.get("/:id", asyncHandler(getEquipment));
router.get("/:id/tests", asyncHandler(getEquipmentTests));

// ── Write (ADMIN only) ────────────────────────────────────────────────────────
router.post("/", requireRole("ADMIN"), asyncHandler(createEquipment));
router.put("/:id", requireRole("ADMIN"), asyncHandler(updateEquipment));
router.delete("/:id", requireRole("ADMIN"), asyncHandler(deleteEquipment));

export default router;

