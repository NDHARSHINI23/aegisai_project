import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { biasScoresTable, registeredModelsTable } from "@workspace/db/schema";

export const biasService = {
  async getLatestScores() {
    // Return latest score per model. PostgreSQL distinct on is tricky, we can use a subquery or ordering
    // For simplicity, we just fetch all and group in code for latest.
    const all = await db.select().from(biasScoresTable).orderBy(biasScoresTable.computedAt);
    const map = new Map<string, typeof all[0]>();
    for (const row of all) {
      if (row.modelId) map.set(row.modelId, row);
    }
    const latest = Array.from(map.values());
    // Attach model metadata
    const models = await db.select().from(registeredModelsTable);
    return latest.map(score => {
      const model = models.find(m => m.id === score.modelId);
      return {
        id: score.id,
        model_id: score.modelId!,
        model_name: model?.name ?? score.modelId!,
        overall: score.overall,
        gender: score.gender,
        race: score.race,
        religion: score.religion,
        computed_at: score.computedAt
      };
    });
  },

  async computeBias(modelId: string) {
    throw new Error(`No subgroup-labelled observations are available for bias computation for model ${modelId}`);
  }
};
