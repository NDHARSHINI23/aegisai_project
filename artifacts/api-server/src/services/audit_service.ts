import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import type { Request } from "express";

export async function recordAudit(req: Request, action: string, resource: string, status = "success", metadata: Record<string, unknown> = {}) {
  await db.insert(auditLogsTable).values({
    userId: req.user?.id ?? null,
    action,
    resource,
    status,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") ?? null,
    metadata,
  });
}
