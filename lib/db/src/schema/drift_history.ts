import { doublePrecision, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { registeredModelsTable } from "./registered_models";

export const driftTypeEnum = pgEnum("drift_type", ["data", "model", "concept"]);
export const driftStatusEnum = pgEnum("drift_status", [
  "stable",
  "warning",
  "critical",
]);

export const driftHistoryTable = pgTable("drift_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: uuid("model_id")
    .notNull()
    .references(() => registeredModelsTable.id, { onDelete: "cascade" }),
  driftType: driftTypeEnum("drift_type").notNull(),
  value: doublePrecision("value").notNull(),
  status: driftStatusEnum("status").notNull().default("stable"),
  label: text("label"), // e.g. "PSI", "JS divergence", "Concept score"
  computedAt: timestamp("computed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DriftHistory = typeof driftHistoryTable.$inferSelect;
export type InsertDriftHistory = typeof driftHistoryTable.$inferInsert;
