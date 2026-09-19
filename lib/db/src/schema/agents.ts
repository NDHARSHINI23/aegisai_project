import {
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { registeredModelsTable } from "./registered_models";
import { usersTable } from "./users";

export const agentStatusEnum = pgEnum("agent_status", ["active", "staging", "archived"]);

export const agentsTable = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  llmModelId: uuid("llm_model_id")
    .notNull()
    .references(() => registeredModelsTable.id),
  tools: jsonb("tools").$type<string[]>().notNull().default([]),
  status: agentStatusEnum("status").notNull().default("staging"),
  maxToolDepth: integer("max_tool_depth").notNull().default(5),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentTrajectoriesTable = pgTable("agent_trajectories", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agentsTable.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  toolCalls: jsonb("tool_calls")
    .$type<Array<{ name: string; success: boolean; output?: string }>>()
    .notNull()
    .default([]),
  toolCallCount: integer("tool_call_count").notNull().default(0),
  toolSuccessCount: integer("tool_success_count").notNull().default(0),
  finalOutput: text("final_output").notNull(),
  hallucinationScore: doublePrecision("hallucination_score"),
  latencyMs: integer("latency_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Agent = typeof agentsTable.$inferSelect;
export type InsertAgent = typeof agentsTable.$inferInsert;
export type AgentTrajectory = typeof agentTrajectoriesTable.$inferSelect;
export type InsertAgentTrajectory = typeof agentTrajectoriesTable.$inferInsert;
