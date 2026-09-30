import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { alertsTable, type InsertAlert } from "@workspace/db/schema";
import { randomUUID } from "node:crypto";

import { appendFileSync } from "node:fs";
import { join } from "node:path";

export const alertService = {
  async getOpen() {
    return await db.select().from(alertsTable).where(eq(alertsTable.isResolved, false));
  },
  async create(type: string, modelId: string, modelName: string, severity: "info"|"warning"|"critical", message: string) {
    const [created] = await db
      .insert(alertsTable)
      .values({
        id: randomUUID(),
        type,
        modelId,
        modelName,
        severity,
        message,
        isResolved: false
      })
      .returning();

    // ── FEATURE: Slack Alert Integration ──
    if (severity === "critical" || severity === "warning") {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      const payload = { text: `🚨 *[${severity.toUpperCase()}] AegisAI Alert* 🚨\n*Model:* ${modelName}\n*Type:* ${type}\n*Message:* ${message}` };

      if (webhookUrl) {
        // Broadcast to real Slack workspace if configured
        fetch(webhookUrl, { method: "POST", body: JSON.stringify(payload) })
          .catch(e => console.error("Slack delivery failed:", e));
      } else {
        // Fallback: Dump to a local mockup log for the user to verify it works
        try {
          appendFileSync(join(process.cwd(), "../../.slack_alerts.log"), `[SLACK MOCK DELIVERED ${new Date().toISOString()}]: ${payload.text}\n\n`);
        } catch (e) {}
      }
    }

    return created;
  },
  async resolve(id: string) {
    const [updated] = await db
      .update(alertsTable)
      .set({ isResolved: true, resolvedAt: new Date() })
      .where(eq(alertsTable.id, id))
      .returning();
    return updated;
  }
};
