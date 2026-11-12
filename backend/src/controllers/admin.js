import { z } from "zod";
import { prisma } from "../db.js";
const fail = (message, status=400) => Object.assign(new Error(message), { status, expose: true });
export async function stats(_req, res) {
  const [users, documents, chatSessions, messages, equipment, tests] = await Promise.all([
    prisma.user.count(),
    prisma.document.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.chatSession.count(), prisma.message.count(), prisma.equipment.count(), prisma.test.count(),
  ]);
  res.json({ users, documents: Object.fromEntries(documents.map(x => [x.status, x._count._all])), chatSessions, messages, equipment, tests });
}
export async function listUsers(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const search = String(req.query.search || "").trim();
  const where = search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {};
  const [items, total] = await Promise.all([prisma.user.findMany({ where, skip: (page-1)*limit, take: limit, orderBy: { createdAt: "desc" }, select: { id:true,name:true,email:true,role:true,createdAt:true } }), prisma.user.count({ where })]);
  res.json({ items, page, limit, total });
}
export async function updateRole(req, res) {
  const { role } = z.object({ role: z.enum(["ADMIN", "ENGINEER"]) }).parse(req.body);
  if (req.params.id === req.user.id && role !== "ADMIN") throw fail("You cannot demote yourself");
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { role }, select: { id:true,name:true,email:true,role:true,createdAt:true } });
  res.json({ user });
}
export async function deleteUser(req, res) {
  if (req.params.id === req.user.id) throw fail("You cannot delete yourself");
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).end();
}
