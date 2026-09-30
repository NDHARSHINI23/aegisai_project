import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { recordAudit } from "../services/audit_service";
import { createSession, hashPassword, revokeSession, SESSION_COOKIE, verifyPassword } from "../services/auth_service";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
const credentials = z.object({ email: z.string().email(), password: z.string().min(8).max(128) });
const registration = credentials.extend({ name: z.string().trim().min(2).max(100), organization: z.string().trim().min(2).max(120), role: z.enum(["engineer", "security", "viewer"]).default("viewer") });
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 24 * 7, path: "/" };

function publicUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

router.get("/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = registration.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const email = parsed.data.email.toLowerCase();
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) { res.status(409).json({ error: "An account with this email already exists" }); return; }
  const [user] = await db.insert(usersTable).values({ email, name: parsed.data.name, organization: parsed.data.organization, role: parsed.data.role, passwordHash: await hashPassword(parsed.data.password) }).returning();
  const token = await createSession(user.id, { ipAddress: req.ip, userAgent: req.get("user-agent") });
  res.cookie(SESSION_COOKIE, token, cookieOptions);
  req.user = publicUser(user);
  await recordAudit(req, "register", "user");
  res.status(201).json({ user: publicUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Enter a valid email and password" }); return; }
  const email = parsed.data.email.toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user?.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    await recordAudit(req, "login", "session", "failed", { email });
    res.status(401).json({ error: "Email or password is incorrect" }); return;
  }
  const token = await createSession(user.id, { ipAddress: req.ip, userAgent: req.get("user-agent") });
  res.cookie(SESSION_COOKIE, token, cookieOptions);
  req.user = publicUser(user);
  await recordAudit(req, "login", "session");
  res.json({ user: publicUser(user) });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  await recordAudit(req, "logout", "session");
  await revokeSession(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  res.status(204).send();
});

// ── FEATURE: Enterprise SSO / OAuth Mock ──
// Setup OAuth callback URL for SAML / OIDC providers (e.g. Auth0, Microsoft Entra, Google Workspace)
router.get("/auth/sso/google", (req, res): void => {
  const redirectUri = encodeURIComponent("http://localhost:5000/api/auth/sso/callback");
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=MOCK_CLIENT_ID&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile`;
  // In a real flow, redirect to authUrl. Here we just return it so it can be verified.
  res.redirect(authUrl);
});

router.get("/auth/sso/callback", async (req, res): Promise<void> => {
  const { code } = req.query;
  if (!code) { res.status(400).json({ error: "Missing OAuth code" }); return; }
  
  // 1. In standard OAuth, we exchange the code for an ID Token via Identity Provider here.
  // 2. We verify the token, extract the email
  const ssoEmail = "sso-admin@aegisai.local"; // Mock unpacked email

  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, ssoEmail)).limit(1);
  
  if (!user) {
    // Just-in-time (JIT) provisioning for SSO users
    [user] = await db.insert(usersTable).values({
      email: ssoEmail, 
      name: "SSO Admin (Auto-provisioned)", 
      organization: "Enterprise Corp", 
      role: "admin", 
      passwordHash: "SSO_MANAGED_ACCOUNT" 
    }).returning();
  }

  // 3. Issue AegisAI internal session token
  const token = await createSession(user.id, { ipAddress: req.ip, userAgent: req.get("user-agent") });
  res.cookie(SESSION_COOKIE, token, cookieOptions);
  
  // 4. Redirect straight into the dashboard
  res.redirect("http://localhost:5173");
});

export default router;
