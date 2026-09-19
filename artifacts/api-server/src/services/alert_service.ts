import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { alertsTable, type InsertAlert } from "@workspace/db/schema";
import { randomUUID } from "node:crypto";

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
