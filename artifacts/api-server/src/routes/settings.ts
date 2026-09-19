import { Router, type IRouter } from "express";
import { desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { auditLogsTable, usersTable } from "@workspace/db/schema";
import { requireRoles } from "../middleware/auth";
import { hashPassword, verifyPassword } from "../services/auth_service";
import { recordAudit } from "../services/audit_service";

const router: IRouter = Router();
const profileBody = z.object({ name: z.string().trim().min(2).max(100), organization: z.string().trim().min(2).max(120), theme: z.enum(["light", "dark", "system"]), notification_preferences: z.record(z.string(), z.boolean()) });
const passwordBody = z.object({ current_password: z.string().min(8), new_password: z.string().min(8).max(128) });

router.get("/settings", async (req, res) => res.json({ user: req.user }));
router.patch("/settings/profile", async (req, res): Promise<void> => {
  const parsed = profileBody.safeParse(req.body);
  if (!parsed.success || !req.user) { res.status(400).json({ error: "Invalid profile settings" }); return; }
  const [user] = await db.update(usersTable).set({ name: parsed.data.name, organization: parsed.data.organization, theme: parsed.data.theme, notificationPreferences: parsed.data.notification_preferences }).where(eq(usersTable.id, req.user.id)).returning();
  req.user = (({ passwordHash: _passwordHash, ...safe }) => safe)(user);
  await recordAudit(req, "profile_updated", "user");
  res.json({ user: req.user });
});
router.post("/settings/password", async (req, res): Promise<void> => {
  const parsed = passwordBody.safeParse(req.body);
  if (!parsed.success || !req.user) { res.status(400).json({ error: "Invalid password request" }); return; }
  const [stored] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);
  if (!stored?.passwordHash || !(await verifyPassword(parsed.data.current_password, stored.passwordHash))) { res.status(400).json({ error: "Current password is incorrect" }); return; }
  await db.update(usersTable).set({ passwordHash: await hashPassword(parsed.data.new_password) }).where(eq(usersTable.id, req.user.id));
  await recordAudit(req, "password_changed", "user");
  res.status(204).send();
});
router.get("/audit-logs", requireRoles("admin", "security"), async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const condition = search ? ilike(auditLogsTable.action, `%${search}%`) : undefined;
  const rows = await db.select({ log: auditLogsTable, userName: usersTable.name, userEmail: usersTable.email }).from(auditLogsTable).leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id)).where(condition).orderBy(desc(auditLogsTable.createdAt)).limit(200);
  res.json(rows.map(({ log, userName, userEmail }) => ({ ...log, user_name: userName, user_email: userEmail })));
});

export default router;
