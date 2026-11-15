import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "../db.js";

/**
 * requireAuth — verifies the Bearer JWT and attaches req.user
 * req.user = { id, name, email, role }
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization header missing or malformed" });
  }

  const token = authHeader.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    return res.status(401).json({ error: "User no longer exists" });
  }

  req.user = user;
  next();
}

