import { db } from "@workspace/db";
import { driftHistoryTable, registeredModelsTable } from "@workspace/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export const driftService = {
  async getLatestDrift() {
    const all = await db.select().from(driftHistoryTable).orderBy(driftHistoryTable.computedAt);
    const map = new Map<string, typeof all[0]>();
    for (const row of all) {
      if (row.modelId) map.set(`${row.modelId}-${row.driftType}`, row);
    }
    const latest = Array.from(map.values());
    const models = await db.select().from(registeredModelsTable);
    
    // Group by model
    const results = models.map(model => {
      const modelDrifts = latest.filter(l => l.modelId === model.id);
      const dataDrift = modelDrifts.find(d => d.driftType === "data") ?? { value: 0, status: "stable", label: "PSI", details: [] };
      const modelDrift = modelDrifts.find(d => d.driftType === "model") ?? { value: 0, status: "stable", label: "JS divergence", details: [] };
      const conceptDrift = modelDrifts.find(d => d.driftType === "concept") ?? { value: 0, status: "stable", label: "Concept score", details: [] };
      
      return {
        model_id: model.id,
        model_name: model.name,
        data_drift: { status: dataDrift.status, value: dataDrift.value, label: dataDrift.label, details: ["prompt_length", "avg_token_frequency"] },
        model_drift: { status: modelDrift.status, value: modelDrift.value, label: modelDrift.label, details: ["faithfulness_score", "accuracy", "latency_ms"] },
        concept_drift: { status: conceptDrift.status, value: conceptDrift.value, label: conceptDrift.label, details: ["machine_learning", "professional_law"] }
      };
    });
    return results;
  },

  async getDriftHistory(modelId: string, days = 30) {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);
    return await db.select().from(driftHistoryTable)
      .where(and(eq(driftHistoryTable.modelId, modelId), gte(driftHistoryTable.computedAt, dateLimit)))
      .orderBy(desc(driftHistoryTable.computedAt));
  },

  async computeDrift(modelId: string) {
    throw new Error(`Drift computation requires a configured reference dataset for model ${modelId}`);
  }
};
