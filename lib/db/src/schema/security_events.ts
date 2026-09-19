import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { registeredModelsTable } from "./registered_models";

export const securitySeverityEnum = pgEnum("security_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const securityEventsTable = pgTable("security_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: uuid("model_id").references(() => registeredModelsTable.id, {
    onDelete: "set null",
  }),
  modelName: text("model_name").notNull(),
  eventType: text("event_type").notNull(), // pii_detected | injection_attempt | toxic_output
  severity: securitySeverityEnum("severity").notNull().default("medium"),
  preview: text("preview").notNull(),
  rawTextHash: text("raw_text_hash"), // SHA-256 of scanned text for deduplication
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SecurityEvent = typeof securityEventsTable.$inferSelect;
export type InsertSecurityEvent = typeof securityEventsTable.$inferInsert;
