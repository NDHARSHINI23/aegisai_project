import type { NextFunction, Request, Response } from "express";
import type { AuthUser } from "../services/auth_service";

type Role = AuthUser["role"];
const permissions: Record<Role, string[]> = {
  admin: ["*"],
  engineer: ["/dashboard", "/settings", "/models", "/agents", "/evaluation", "/experiments", "/dvc", "/retraining", "/drift"],
  security: ["/dashboard", "/settings", "/evaluation", "/hallucination", "/bias", "/security", "/alerts", "/audit-logs"],
  viewer: ["/dashboard", "/settings", "/models", "/agents", "/evaluation", "/reports"],
};

function canAccess(role: Role, path: string) {
  const allowed = permissions[role];
  return allowed.includes("*") || allowed.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function enforcePermissions(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/auth/me" || req.path.startsWith("/auth/")) return next();
  if (!req.user || !canAccess(req.user.role, req.path)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  if (req.user.role === "viewer" && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    res.status(403).json({ error: "Viewer accounts are read-only" });
    return;
  }
  next();
}

export { permissions };
