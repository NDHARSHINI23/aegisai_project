import { doublePrecision, integer, pgEnum, pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const modelStatusEnum = pgEnum("model_status", ["development", "testing", "staging", "production", "archived"]);
export const promotionStatusEnum = pgEnum("promotion_status", ["none", "pending", "approved", "rejected"]);

export const registeredModelsTable = pgTable("registered_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  framework: text("framework").notNull(),
  endpointUrl: text("endpoint_url"),
  description: text("description"),
  
  owner: text("owner"),
  datasetVersion: text("dataset_version"),
  trainingDate: timestamp("training_date", { withTimezone: true }),
  gitCommit: text("git_commit"),
  benchmarkResults: jsonb("benchmark_results"),
  environment: text("environment"),
  promotionApprovalStatus: promotionStatusEnum("promotion_approval_status").notNull().default("none"),
  
  status: modelStatusEnum("status").notNull().default("development"),
  accuracy: doublePrecision("accuracy").notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RegisteredModel = typeof registeredModelsTable.$inferSelect;
export type InsertRegisteredModel = typeof registeredModelsTable.$inferInsert;
