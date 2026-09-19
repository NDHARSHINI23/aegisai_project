import { doublePrecision, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { registeredModelsTable } from "./registered_models";

export const retrainingRunsTable = pgTable("retraining_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: uuid("model_id").references(() => registeredModelsTable.id, {
    onDelete: "set null",
  }),
  modelName: text("model_name").notNull(),
  triggerReason: text("trigger_reason").notNull(),
  oldAccuracy: doublePrecision("old_accuracy").notNull(),
  newAccuracy: doublePrecision("new_accuracy").notNull(),
  delta: doublePrecision("delta").notNull(),
  outcome: text("outcome").notNull().default("same"), // improved | same | degraded
  mlflowRunId: text("mlflow_run_id"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type RetrainingRun = typeof retrainingRunsTable.$inferSelect;
export type InsertRetrainingRun = typeof retrainingRunsTable.$inferInsert;
