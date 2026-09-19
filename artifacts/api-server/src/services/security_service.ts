import { db } from "@workspace/db";
import { securityEventsTable, registeredModelsTable } from "@workspace/db/schema";
import { randomUUID, createHash } from "node:crypto";
import { alertService } from "./alert_service";
import { eq } from "drizzle-orm";

export const securityService = {
  async scanText(text: string, modelId?: string) {
    const findings: Array<{ type: string; value: string }> = [];
    if (/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(text)) findings.push({ type: "EMAIL_ADDRESS", value: "masked email" });
    if (/\b(?:\d{3}-\d{2}-\d{4}|\d{3}\s\d{2}\s\d{4})\b/.test(text)) findings.push({ type: "US_SSN", value: "masked ssn" });
    const isInjection = /(ignore previous|reveal system prompt|jailbreak)/i.test(text);
    if (isInjection) findings.push({ type: "PROMPT_INJECTION", value: "pattern detected" });

    const masked = text.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[EMAIL_REDACTED]").replace(/\b(?:\d{3}-\d{2}-\d{4}|\d{3}\s\d{2}\s\d{4})\b/g, "[SSN_REDACTED]");
    
    if (findings.length > 0 && modelId) {
      const [model] = await db.select().from(registeredModelsTable).where(eq(registeredModelsTable.id, modelId)).limit(1);
      const modelName = model?.name ?? 'Unknown Model';
      const eventType = isInjection ? "injection_attempt" : "pii_detected";
      const severity = isInjection ? "high" : "critical";
      
      const rawTextHash = createHash("sha256").update(text).digest("hex");
      
      const [event] = await db.insert(securityEventsTable).values({
        id: randomUUID(),
        modelId,
        modelName,
        eventType,
        severity,
        preview: findings.map(f => f.type).join(", "),
        rawTextHash
      }).returning();
      
      const alertSeverity = severity === "high" ? "warning" : "critical";
      await alertService.create(eventType, modelId, modelName, alertSeverity, `${eventType} during scan: ${event.preview}`);
    }

    return { risk: findings.length ? "high" : "low", findings, masked_text: masked };
  },

  async getEvents() {
    return await db.select().from(securityEventsTable).orderBy(securityEventsTable.createdAt);
  }
};
