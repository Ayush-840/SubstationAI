import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import {
  getScene,
  getScript,
  createSession,
  mySessions,
} from "../controllers/xr.js";

const router = Router();

// The whole XR surface needs a JWT. Sessions are scoped to req.user.
router.use(requireAuth);

router.get("/scenes/:equipmentId", asyncHandler(getScene));
router.get("/tests/:testId/script", asyncHandler(getScript));
router.post("/sessions", asyncHandler(createSession));
router.get("/sessions/me", asyncHandler(mySessions));

export default router;
