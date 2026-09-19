import { doublePrecision, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { registeredModelsTable } from "./registered_models";

export const costLogsTable = pgTable("cost_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: uuid("model_id")
    .notNull()
    .references(() => registeredModelsTable.id, { onDelete: "cascade" }),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  estimatedCostUsd: doublePrecision("estimated_cost_usd").notNull().default(0),
  loggedAt: timestamp("logged_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CostLog = typeof costLogsTable.$inferSelect;
export type InsertCostLog = typeof costLogsTable.$inferInsert;
