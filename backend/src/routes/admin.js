import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { listUsers, stats, updateRole, deleteUser } from "../controllers/admin.js";
const router = Router();
router.get("/stats", asyncHandler(stats));
router.get("/users", asyncHandler(listUsers));
router.patch("/users/:id/role", asyncHandler(updateRole));
router.delete("/users/:id", asyncHandler(deleteUser));
export default router;
