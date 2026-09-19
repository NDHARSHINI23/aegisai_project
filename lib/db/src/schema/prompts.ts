import { AnyPgColumn, doublePrecision, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agentsTable } from "./agents";
import { registeredModelsTable } from "./registered_models";

export const promptVersionsTable = pgTable("prompt_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  versionNumber: integer("version_number").notNull(),
  agentId: uuid("agent_id").references(() => agentsTable.id),
  parentId: uuid("parent_id").references((): AnyPgColumn => promptVersionsTable.id),
  modelId: uuid("model_id").references(() => registeredModelsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promptEvalResultsTable = pgTable("prompt_eval_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  promptVersionId: uuid("prompt_version_id")
    .notNull()
    .references(() => promptVersionsTable.id, { onDelete: "cascade" }),
  evalScore: doublePrecision("eval_score").notNull(),
  avgTokens: integer("avg_tokens").notNull(),
  avgCostUsd: doublePrecision("avg_cost_usd").notNull(),
  mlflowRunId: text("mlflow_run_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PromptVersion = typeof promptVersionsTable.$inferSelect;
export type InsertPromptVersion = typeof promptVersionsTable.$inferInsert;
export type PromptEvalResult = typeof promptEvalResultsTable.$inferSelect;
export type InsertPromptEvalResult = typeof promptEvalResultsTable.$inferInsert;
