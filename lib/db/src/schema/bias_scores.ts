import { doublePrecision, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { registeredModelsTable } from "./registered_models";

export const biasScoresTable = pgTable("bias_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: uuid("model_id")
    .notNull()
    .references(() => registeredModelsTable.id, { onDelete: "cascade" }),
  overall: doublePrecision("overall").notNull().default(0),
  gender: doublePrecision("gender").notNull().default(0),
  race: doublePrecision("race").notNull().default(0),
  religion: doublePrecision("religion").notNull().default(0),
  computedAt: timestamp("computed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BiasScore = typeof biasScoresTable.$inferSelect;
export type InsertBiasScore = typeof biasScoresTable.$inferInsert;
